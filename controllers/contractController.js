import Contract from "../models/Contract.js";
import User from "../models/User.js";
import sendEmail from "../utils/sendEmail.js";

export const createContract = async (req, res) => {
  try {
    const { clientEmail, AgencyName, contractData} = req.body;

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
