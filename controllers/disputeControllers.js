import axios from "axios";
import Contract from "../models/Contract.js";
import Transaction from "../models/Transaction.js";


export const raiseClientDispute = async (req, res) => {
  const contractId = req.params.id;

  try {
    const contract = await Contract.findById(contractId).populate("createdBy client");

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const deadlinePassed = new Date(contract.contractData?.DeadLine) < new Date();
    const noWorkUploaded =
      (!contract.workProof?.attachments?.length && !contract.workProof?.links?.length);

    if (!deadlinePassed || !noWorkUploaded) {
      return res.status(400).json({ error: "Dispute not allowed. Conditions not met." });
    }

    const amount = contract.contractData?.totalAmount;
    if (!amount) {
      return res.status(400).json({ error: "Contract amount is missing." });
    }

    // Create a refund transaction
    const refundTx = new Transaction({
      type: "refund",
      payer: contract.createdBy?._id,         // usually the client
      payee: contract.client?._id,            // same here, or whoever receives refund
      amount,
      currency: contract.contractData?.currency || "INR",
      contract: contract._id,
      status: "refunded",
      refundedAt: new Date(),
      notes: "Refund due to missed work submission after deadline"
    });

    await refundTx.save();

    contract.status = "refunded";
    await contract.save();

    return res.status(200).json({ message: "Refund issued successfully", transaction: refundTx });
  } catch (error) {
    console.error("Client dispute error:", error);
    return res.status(500).json({ error: "Server error during client dispute." });
  }
};


export const raiseFreelancerDispute = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("[Dispute] Contract ID:", id);

    const contract = await Contract.findById(id)
      .populate("createdBy")
      .populate("client");

    if (!contract) {
      console.log("[Dispute] Contract not found");
      return res.status(404).json({ error: "Contract not found" });
    }

    console.log("[Dispute] Contract found:", contract._id);
    console.log("[Dispute] Contract status:", contract.status);

    // Optional: Ensure contract is in a state that allows dispute
    const validStatuses = ["work-submitted"];
    if (!validStatuses.includes(contract.status)) {
      console.log("[Dispute] Invalid contract status for dispute:", contract.status);
      return res.status(400).json({ error: "Contract cannot be accepted in current state" });
    }

    const freelancer = contract.createdBy;
    const client = contract.client;

    console.log("[Dispute] Freelancer:", freelancer._id);
    console.log("[Dispute] Client:", client._id);

    // Deadline check
    const deadline = new Date(contract.contractData?.DeadLine);
    const now = new Date();
    const deadlinePassed = deadline < now;

    console.log("[Dispute] Deadline:", deadline);
    console.log("[Dispute] Current Time:", now);
    console.log("[Dispute] Deadline passed?", deadlinePassed);

    if (!deadlinePassed) {
      console.log("[Dispute] Deadline not yet passed");
      return res.status(400).json({ error: "Cannot raise dispute before deadline" });
    }

    // Work check
    const hasWork =
      contract.workProof?.attachments?.length > 0 ||
      contract.workProof?.links?.length > 0;

    console.log("[Dispute] Has work proof?", hasWork);
    if (!hasWork) {
      console.log("[Dispute] No work proof uploaded");
      return res.status(400).json({ error: "No work uploaded, cannot raise dispute" });
    }

    const { contractData } = contract;
    

const payLoad = {
  contractData: {
    ...contract.contractData,
    links: contract.workProof?.links || [],
    attachments: contract.workProof?.attachments || []
  }
};

console.log("[Dispute] Final Payload to AI:", JSON.stringify(payLoad, null, 2));

const response = await axios.post("https://dispute.onrender.com/dispute/verify-proof", payLoad);

    console.log("[Dispute] Dispute API Response:", response.data);

    const { ok, reason, status } = response.data;

    if (!ok) {
      console.log("[Dispute] External service rejected request");
      return res.status(400).json({ error: "Dispute service error" });
    }

if (status === "accepted") {
  console.log("[Dispute] Dispute accepted – processing refund");

  const transaction = new Transaction({
    contract: id,
    payer: client._id,
    payee: freelancer._id,
    type: "refund",
    amount: contract.contractData?.totalAmount,
    currency: contract.contractData?.currency || "INR",
    status: "refunded",
    refundedAt: new Date(),
    notes: "Dispute accepted by AI"
  });

  await transaction.save();

  contract.status = "disputed";
  await contract.save();

  return res.status(200).json({
    message: "Dispute accepted. Refund processed.",
    reason,
    freelancer: {
      id: freelancer._id,
      name: freelancer.username || freelancer.agencyName,
    },
    client: {
      id: client._id,
      name: client.username || client.agencyName,
    },
  });
} else {
      console.log("[Dispute] Dispute rejected by AI service");

      return res.status(200).json({
        message: "Dispute rejected",
        reason,
        freelancer: {
          id: freelancer._id,
          name: freelancer.username || freelancer.agencyName,
        },
        client: {
          id: client._id,
          name: client.username || client.agencyName,
        },
      });
    }
  } catch (err) {
    console.error("[Dispute] Error in raiseFreelancerDispute:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
