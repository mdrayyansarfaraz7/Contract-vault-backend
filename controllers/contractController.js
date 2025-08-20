import Contract from "../models/Contract.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import sendEmail from "../utils/sendEmail.js";

export const createContract = async (req, res) => {
  try {
    const { clientEmail, AgencyName, contractData } = req.body;

    const freelancerId = req.user?.id;
    if (!freelancerId) {
      return res.status(401).json({ message: "Unauthorized: Freelancer not found" });
    }

    const freelancer = await User.findById(freelancerId);
    if (!freelancer) {
      return res.status(404).json({ message: "Freelancer not found" });
    }

    if (freelancer.role !== "freelancer") {
      return res.status(403).json({ message: "Only freelancers can create contracts." });
    }

    const clientUser = await User.findOne({ email: clientEmail });

    const newContract = new Contract({
      createdBy: freelancer._id,
      client: clientUser ? clientUser._id : null,
      clientEmail,
      AgencyName,
      contractData,
      signatures: {
        freelancer: {
          signedBy: freelancer._id,
          date: new Date(),
          ipAddress: req.ip,
          signatureImageURL: freelancer.signature?.imageURL || null,
          signatureHash: freelancer.signature?.hash || null,
        },
        pendingParty: "client",
      },
      status: "draft",
    });

    const savedContract = await newContract.save();

    await User.findByIdAndUpdate(freelancer._id, {
      $push: { contracts: savedContract._id },
    });


    const dummyPDFLink = "https://morth.nic.in/sites/default/files/dd12-13_0.pdf";
    savedContract.contractFileURL = dummyPDFLink;
    savedContract.status = "sent";
    await savedContract.save();

    let emailHtml;
    if (clientUser) {
      // Client already registered
      emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; background:#f9f9f9; padding:20px; border-radius:10px;">
          <h2 style="color:#2e7d32;">📄 New Contract from ${freelancer.fullName}</h2>
          <p>Hello ${clientUser.fullName},</p>
          <p>You have received a new contract to review and respond.</p>
          <p><strong>Project:</strong> ${contractData.projectDescription || "N/A"}<br/>
          <strong>Total Amount:</strong> ${contractData.totalAmount || "N/A"} ${contractData.currency}</p>
          <p><a href="${dummyPDFLink}" target="_blank" style="color:#2e7d32; text-decoration:none; font-weight:bold;"> View Contract PDF</a></p>
          <a href="http://localhost:5000/login" 
             style="display:inline-block; padding:12px 20px; background:#2e7d32; color:white; border-radius:8px; text-decoration:none; font-weight:bold; margin-top:15px;">
             🔗 Login & Review Contract
          </a>
          <p style="margin-top:30px;">Best regards,<br/>Contract Vault Team</p>
        </div>
      `;
    } else {
      // Client not registered
      emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; background:#f9f9f9; padding:20px; border-radius:10px;">
          <h2 style="color:#2e7d32;">📄 New Contract Invitation from ${freelancer.username}</h2>
          <p>Hello,</p>
          <p>You have been invited to review and sign a contract.</p>
          <p><strong>Project:</strong> ${contractData.projectDescription || "N/A"}<br/>
          <strong>Total Amount:</strong> ${contractData.totalAmount || "N/A"} ${contractData.currency}</p>
          <p><a href="${dummyPDFLink}" target="_blank" style="color:#2e7d32; text-decoration:none; font-weight:bold;">📄 View Contract PDF</a></p>
          <a href="http://localhost:5000/register" 
             style="display:inline-block; padding:12px 20px; background:#2e7d32; color:white; border-radius:8px; text-decoration:none; font-weight:bold; margin-top:15px;">
             Register & Accept Contract
          </a>
          <p style="margin-top:30px;">Best regards,<br/>Contract Vault Team</p>
        </div>
      `;
    }

    const emailSubject = "New Contract for Review";
    await sendEmail(clientEmail, emailSubject, emailHtml);

    if (clientUser) {
      await User.findByIdAndUpdate(clientUser._id, {
        $push: { contracts: savedContract._id },
      });
    }

    res.status(201).json({
      message: "Contract created, PDF attached, and email sent.",
      contract: savedContract,
    });
  } catch (error) {
    console.error("Error creating contract:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

export const acceptContractCreatOrderPayment=  async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id; 
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    if (contract.status !== "sent") {
      return res.status(400).json({ error: "Contract cannot be accepted in current state" });
    }

    const amountInPaise = contract.contractData.totalAmount * 100;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: contract.contractData.currency || "INR",
      receipt: `contract_${id}`,
    });

    // Create transaction record
    const transaction = await Transaction.create({
      contract: id,
      payer: clientId,                  // from token
      payee: contract.createdBy,        // freelancer who made the contract
      type: "escrow-funding",
      amount: contract.contractData.totalAmount,
      currency: contract.contractData.currency,
      razorpayOrderId: order.id,
      status: "initiated",
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      transactionId: transaction._id,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export const successfullPayment=async (req, res) => {
  try {
    const { id } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    // Find matching transaction
    const transaction = await Transaction.findOne({ contract: id, razorpayOrderId: razorpay_order_id });
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    //  Update transaction & contract
    transaction.razorpayPaymentId = razorpay_payment_id;
    transaction.razorpaySignature = razorpay_signature;
    transaction.status = "in_escrow";
    transaction.fundedAt = new Date();
    await transaction.save();

    contract.status = "accepted"; 
    contract.escrow = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amountFunded: transaction.amount,
      currency: transaction.currency,
      fundedAt: transaction.fundedAt,
    };
    await contract.save();

    return res.json({ message: "Payment successful, contract accepted", contract, transaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const rejectContract= async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user._id; // from your auth middleware

    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    // Only client can reject, and only if contract is still pending
    if (contract.status !== "sent") {
      return res.status(400).json({ error: "Contract cannot be rejected in current state" });
    }
    if (contract.client.toString() !== clientId.toString()) {
      return res.status(403).json({ error: "You are not authorized to reject this contract" });
    }

    contract.status = "declined";
    await contract.save();

    return res.json({ message: "Contract rejected successfully", contract });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
