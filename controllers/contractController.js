import Contract from "../models/Contract.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import razorpay from "../utils/razorpay.js";
import sendEmail from "../utils/sendEmail.js";
import crypto from "crypto";
import axios from "axios";

export const sendContract = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id);
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    console.log(contract);
    res.status(200).json({ contract });
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createContract = async (req, res) => {
  try {
    console.log("🔍 Incoming request to create contract:");
    console.log("➡️ req.body:", req.body);
    console.log("➡️ req.user:", req.user);

    const { clientEmail, AgencyName, contractData } = req.body;
    const freelancerId = req.user?.id;

    if (!freelancerId) {
      console.warn("⛔ Unauthorized: No freelancer ID found in req.user");
      return res.status(401).json({ message: "Unauthorized: Freelancer not found" });
    }

    const freelancer = await User.findById(freelancerId);
    if (!freelancer) {
      console.warn("⛔ Freelancer not found in DB:", freelancerId);
      return res.status(404).json({ message: "Freelancer not found" });
    }

    if (freelancer.role !== "freelancer") {
      console.warn("⛔ User is not a freelancer:", freelancer.role);
      return res.status(403).json({ message: "Only freelancers can create contracts." });
    }

    const clientUser = await User.findOne({ email: clientEmail });
    console.log("👥 Client user:", clientUser ? clientUser._id : "Not registered");

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
    console.log("✅ Contract saved in DB:", savedContract._id);

    await User.findByIdAndUpdate(freelancer._id, {
      $push: { contracts: savedContract._id },
    });
    console.log(" Contract linked to freelancer:", freelancer._id);

    const CtrData = {
      contractId: savedContract._id,
      userId: freelancer._id,
      currentDate: new Date().toISOString().split('T')[0],
     fullName_freelancer: freelancer?.fullName || freelancer?.username || freelancer?._id || " ",
     fullName_client: clientUser?.profile?.fullName || AgencyName || clientUser?._id || " ",
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
    };

    console.log("📄 Payload for PDF generation:", CtrData);

    const data = await axios.post(
      'https://contractvault-sc-2.onrender.com/create-contract',
      CtrData
    );

    console.log("✅ PDF generated. URL:", data.data.url);

    savedContract.contractFileURL = data.data.url;
    savedContract.status = "sent";
    await savedContract.save();

    let emailHtml;
    if (clientUser) {
      emailHtml = `<div style="font-family: Arial, sans-serif; color: #333; background:#f9f9f9; padding:20px; border-radius:10px;">
          <h2 style="color:#2e7d32;"> New Contract from ${freelancer.fullName}</h2>
          <p>Hello ${clientUser.fullName},</p>
          <p>You have received a new contract to review and respond.</p>
          <p><strong>Project:</strong> ${contractData.projectDescription || "N/A"}<br/>
          <strong>Total Amount:</strong> ${contractData.totalAmount || "N/A"} ${contractData.currency}</p>
          <p><a href="${data.data.url}" target="_blank" style="color:#2e7d32; text-decoration:none; font-weight:bold;"> View Contract PDF</a></p>
          <a href="http://localhost:5000/login" 
             style="display:inline-block; padding:12px 20px; background:#2e7d32; color:white; border-radius:8px; text-decoration:none; font-weight:bold; margin-top:15px;">
             Login & Review Contract
          </a>
          <p style="margin-top:30px;">Best regards,<br/>Contract Vault Team</p>
        </div>`; 
    } else {
      emailHtml = `<div style="font-family: Arial, sans-serif; color: #333; background:#f9f9f9; padding:20px; border-radius:10px;">
          <h2 style="color:#2e7d32;"> New Contract Invitation from ${freelancer.username}</h2>
          <p>Hello,</p>
          <p>You have been invited to review and sign a contract.</p>
          <p><strong>Project:</strong> ${contractData.projectDescription || "N/A"}<br/>
          <strong>Total Amount:</strong> ${contractData.totalAmount || "N/A"} ${contractData.currency}</p>
          <p><a href="${data.data.url}" target="_blank" style="color:#2e7d32; text-decoration:none; font-weight:bold;">📄 View Contract PDF</a></p>
          <a href="http://localhost:5000/register" 
             style="display:inline-block; padding:12px 20px; background:#2e7d32; color:white; border-radius:8px; text-decoration:none; font-weight:bold; margin-top:15px;">
             Register & Accept Contract
          </a>
          <p style="margin-top:30px;">Best regards,<br/>Contract Vault Team</p>
        </div>`; // unchanged
    }

    const emailSubject = "New Contract for Review";
    console.log(`📧 Sending email to ${clientEmail}`);
    await sendEmail(clientEmail, emailSubject, emailHtml);
    console.log("✅ Email sent successfully");

    if (clientUser) {
      await User.findByIdAndUpdate(clientUser._id, {
        $push: { contracts: savedContract._id },
      });
      console.log("📎 Contract linked to client:", clientUser._id);
    }

    res.status(201).json({
      message: "Contract created, PDF attached, and email sent.",
      contract: savedContract,
    });
  } catch (error) {
    console.error("❌ Error creating contract:", error);
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

    // Populate both freelancer (createdBy) and client
    const contract = await Contract.findById(id)
      .populate("createdBy")
      .populate("client");

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const transaction = await Transaction.findOne({
      contract: id,
      razorpayOrderId: razorpay_order_id,
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Update transaction
    transaction.razorpayPaymentId = razorpay_payment_id;
    transaction.razorpaySignature = razorpay_signature;
    transaction.status = "in_escrow";
    transaction.fundedAt = new Date();
    await transaction.save();

    // Assign client if not already set
    if (!contract.client) {
      contract.client = req.user.id;
      await User.findByIdAndUpdate(req.user.id, {
        $push: { contracts: contract._id },
      });
    }

    const clientDetails = await User.findById(req.user.id);

    contract.autoExpireDays = 30;

    // Build contract data payload with populated details
    const CtrData = {
      contractId: contract._id,
      userId: contract.createdBy._id,
      currentDate: new Date().toISOString().split("T")[0],
      fullName_freelancer: contract.createdBy.profile?.fullName || contract.createdBy.username,
      fullName_client: contract.client?.profile?.fullName || clientDetails?.profile?.fullName || "",
      agencyName: contract.client?.profile?.companyName || contract.AgencyName || "",
      clientEmail: contract.client?.email || contract.clientEmail || "",
      userEmail: contract.createdBy.email,
      signatureUser: contract.createdBy.signature?.imageURL || "",
      signatureClient: contract.client?.signature?.imageURL || clientDetails?.signature?.imageURL || "",
      contractData: {
        projectDescription: contract.contractData.projectDescription,
        startDate: new Date().toISOString().split("T")[0],
        DeadLine: contract.contractData.DeadLine,
        task: contract.contractData.task,
        totalAmount: contract.contractData.totalAmount,
        currency: contract.contractData.currency,
      },
    };

    try {
      const response = await axios.post(
        "https://contractvault-sc-2.onrender.com/isAccepted",
        CtrData
      );

      const contractUrl = response.data.url || response.data;
      contract.contractFileURL = contractUrl;
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
    contract.status='funded';

    await contract.save();

    return res.json({
      message: "Payment successful, contract accepted",
      contract,
      transaction,
    });
  } catch (err) {
    console.error("Server error in successfullPayment:", err);
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

export const submitWorkProof = async (req, res) => {
  try {
    const { id } = req.params;
    const rawLinks = req.body.links;
    console.log("Raw Links received:", rawLinks);

    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    let parsedLinks = [];
    if (rawLinks) {
      parsedLinks = Array.isArray(rawLinks) ? rawLinks : [rawLinks];
    }

    let attachments = [];
    if (req.files && req.files.attachments) {
      attachments = req.files.attachments.map(file => ({
        url: file.path,
        public_id: file.filename,
        uploadedAt: new Date(),
        submittedAt: new Date(),
      }));
    }

    contract.workProof.links.push(...parsedLinks);
    contract.workProof.attachments=attachments;
    contract.status='work-submitted';
    await contract.save();

    console.log(contract.workProof);

    res.status(200).json({
      message: "Work submitted successfully",
      contract,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const approveContract = async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id).populate("client createdBy");
    console.log(contract);
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    if (contract.status !== "work-submitted") {
      return res.status(400).json({ message: "Work not yet submitted" });
    }

    if (!contract.escrow.amountFunded || contract.escrow.amountFunded <= 0) {
      return res.status(400).json({ message: "No escrow funds available" });
    }

    // create transaction
    const txn = new Transaction({
      contract: contract._id,
      payer: contract.client._id,
      payee: contract.createdBy._id,
      type: "payout",
      amount: contract.escrow.amountFunded,
      currency: contract.escrow.currency,
      status: "released",
      razorpayOrderId: contract.escrow.razorpayOrderId,
      razorpayPaymentId: contract.escrow.razorpayPaymentId,
      fundedAt: contract.escrow.fundedAt,
      releasedAt: new Date(),
      notes: `Payout released on approval`,
    });
    await txn.save();

    // update contract
    contract.status = "released";
    contract.escrow.releasedAt = new Date();
    await contract.save();

    res.status(200).json({
      message: "Contract approved and payout released",
      contract,
      transaction: txn,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};