import Contract from "../models/Contract.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import razorpay from "../utils/razorpay.js";
import sendEmail from "../utils/sendEmail.js";
import crypto from "crypto";
import axios from "axios";

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


    // const dummyPDFLink = "https://morth.nic.in/sites/default/files/dd12-13_0.pdf";
    const CtrData = {
      contractId: savedContract._id,
      userId: freelancer._id,
      currentDate: new Date().toISOString().split('T')[0],
      fullName_freelancer: freelancer.username,
      fullName_client: clientUser ? clientUser.username : "",
      agencyName: AgencyName,
      clientEmail: clientEmail,
      userEmail: freelancer.email,
      signatureUser: freelancer.signature.imageURL,
      signatureClient: "",
      contractData: {
        projectDescription: contractData.projectDescription,
        startDate: "",
        DeadLine: contractData.DeadLine,
        task: contractData.task,
        totalAmount: contractData.totalAmount,
        currency: contractData.currency
      }
    }

    console.log(CtrData);
    const data = await axios.post('https://contractvault-sc-2.onrender.com/create-contract', CtrData);
    savedContract.contractFileURL = data.data.url;
    savedContract.status = "sent";
    await savedContract.save();

    let emailHtml;
    if (clientUser) {
      emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; background:#f9f9f9; padding:20px; border-radius:10px;">
          <h2 style="color:#2e7d32;">📄 New Contract from ${freelancer.fullName}</h2>
          <p>Hello ${clientUser.fullName},</p>
          <p>You have received a new contract to review and respond.</p>
          <p><strong>Project:</strong> ${contractData.projectDescription || "N/A"}<br/>
          <strong>Total Amount:</strong> ${contractData.totalAmount || "N/A"} ${contractData.currency}</p>
          <p><a href="${data.data.url}" target="_blank" style="color:#2e7d32; text-decoration:none; font-weight:bold;"> View Contract PDF</a></p>
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

export const acceptContractCreatOrderPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: "Contract not found" });

    if (contract.status !== "sent")
     {
      return res.status(400).json({ error: "Contract cannot be accepted in current state" });
    }

    const amountInPaise = contract.contractData.totalAmount * 100;

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: contract.contractData.currency || "INR",
      receipt: `contract_${id}`,
    });

    const transaction = await Transaction.create({
      contract: id,
      payer: clientId,                  
      payee: contract.createdBy,        
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

export const successfullPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Find contract
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    // Check transactions
    const allTransactions = await Transaction.find({ contract: id });
    console.log("👉 All transactions for this contract:", allTransactions);

    const transaction = await Transaction.findOne({
      contract: id,
      razorpayOrderId: razorpay_order_id,
    });

    if (!transaction) {
      console.log("❌ No transaction found with contract:", id, "and razorpayOrderId:", razorpay_order_id);
      return res.status(404).json({ error: "Transaction not found" });
    }

    console.log("✅ Found transaction:", transaction._id, "status:", transaction.status);

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.log("❌ Signature mismatch!");
      return res.status(400).json({ error: "Invalid payment signature" });
    }
    console.log("✅ Signature verified successfully");

    // Update transaction
    transaction.razorpayPaymentId = razorpay_payment_id;
    transaction.razorpaySignature = razorpay_signature;
    transaction.status = "in_escrow";
    transaction.fundedAt = new Date();
    await transaction.save();

    // If client not already set, attach and generate contract file
    if (!contract.client) {
      contract.client = req.user.id;

      await User.findByIdAndUpdate(req.user.id, {
        $push: { contracts: contract._id },
      });
    }

      const clientDetails = await User.findById(req.user.id);
      contract.autoExpireDays = 30;

      const CtrData = {
        contractId: contract._id,
        userId: contract.freelancer,
        currentDate: new Date().toISOString().split("T")[0],
        fullName_freelancer: "",
        fullName_client: "",
        agencyName: "",
        clientEmail: "",
        userEmail: "",
        signatureUser: "",
        signatureClient: clientDetails?.signature?.imageURL || "",
        contractData: {
          projectDescription: contract.projectDescription,
          startDate: new Date().toISOString().split("T")[0],
          DeadLine: contract.DeadLine,
          task: contract.task,
          totalAmount: contract.totalAmount,
          currency: contract.currency,
        },
      };

      try {
        const response = await axios.post(
          "https://contractvault-sc-2.onrender.com/isAccepted",
          CtrData
        );

        const contractUrl = response.data.url || response.data;
        contract.contractFileURL = contractUrl;
        console.log("Contract PDF URL updated:", contractUrl);
      } catch (err) {
        console.error("Failed to generate contract URL:", err.message);
      }
    

    // Update contract escrow status
    contract.status = "accepted";
    contract.escrow = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amountFunded: transaction.amount,
      currency: transaction.currency,
      fundedAt: transaction.fundedAt,
    };

    await contract.save();
    console.log("✅ Contract updated:", contract._id, "status now:", contract.status);

    return res.json({
      message: "Payment successful, contract accepted",
      contract,
      transaction,
    });
  } catch (err) {
    console.error("💥 Server error in successfullPayment:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const rejectContract = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id; // from your auth middleware

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
