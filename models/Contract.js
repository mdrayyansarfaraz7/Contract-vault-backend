// models/Contract.js
import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    // 1. Basic Info
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

    // 2. Contract Content
    contractData: {
      projectDescription: { type: String, default: "" },
      paymentTerms: { type: [String], default: [] },
      startDate: { type: Date, default: null }, 
      endDate: { type: Date, default: null },   
      totalAmount: { type: Number, default: null },
      currency: { type: String, default: "INR" }, // since using Razorpay
      additionalClauses: { type: [String], default: [] },
    },

    // Contract file (generated PDF, etc.)
    contractFileURL: { type: String, default: null },

    // 3. Lifecycle
    status: {
      type: String,
      enum: [
        "draft",        // still being prepared
        "sent",         // sent to client
        "viewed",       // client viewed
        "accepted",     // both parties signed
        "declined",     // client refused
        "funded",       // client deposited into escrow
        "work-submitted",// freelancer submitted proof
        "approved",     // client approved work
        "released",     // payment released to freelancer
        "disputed",     // dispute raised
        "refunded",     // refunded to client
      ],
      default: "draft",
    },

    // 4. ML template tracking
    templateId: { type: String, default: null },
    version: { type: Number, default: 1 },
    isFinal: { type: Boolean, default: false },

    // 5. Signatures (snapshots from User at signing time)
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

    // 6. Escrow / Payment Tracking
    escrow: {
      razorpayOrderId: { type: String, default: null }, // when order created
      razorpayPaymentId: { type: String, default: null }, // when funded
      amountFunded: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      fundedAt: Date,
      releasedAt: Date,
      refundedAt: Date,
    },

    // 7. Tamper-proofing
    contractHash: String, // hash of full PDF + metadata
    lastHashVerification: Date,

    // 8. Expiration & deadlines
    expiresAt: Date,
    autoExpireDays: { type: Number, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Contract", contractSchema);
