import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    client: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      default: null, // client might not have an account yet
    },

    clientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // ML-generated or user-entered contract data
    contractData: {
      projectDescription: { type: String, default: "" },
      deliverables: { type: [String], default: [] },
      paymentTerms: { type: String, default: "" },
      timeline: { type: String, default: "" },
      totalAmount: { type: Number, default: null },
      currency: { type: String, default: "USD" },
      additionalClauses: { type: [String], default: [] },
    },

    // PDF or file location
    contractFileURL: { type: String, default: null },

    // Tracks where in the lifecycle the contract is
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "accepted", "declined"],
      default: "draft",
    },

    // ML template tracking
    templateId: { type: String, default: null },
    version: { type: Number, default: 1 },
    isFinal: { type: Boolean, default: false },

    signatures: {
      freelancer: {
        signedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        date: Date,
        ipAddress: String,
        signatureImageURL: String,
        signatureHash: String,
      },
      client: {
        signedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        date: Date,
        ipAddress: String,
        signatureImageURL: String,
        signatureHash: String,
      },
      pendingParty: {
        type: String,
        enum: ["freelancer", "client", null],
        default: "client",
      },
    },

    // Tamper-proofing
    contractHash: String, // hash of full PDF + metadata
    lastHashVerification: Date,

    // Expiration & deadlines
    expiresAt: Date,
    autoExpireDays: { type: Number, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Contract", contractSchema);
