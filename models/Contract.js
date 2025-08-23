// models/Contract.js
import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    clientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    AgencyName: {
      type: String,
    },

    contractData: {
      projectDescription: { type: String, default: "" },
      startDate: { type: Date, default: null }, //day contract is accepted
      task: { type: [String], default: [] },
      DeadLine: { type: Date, default: null },
      totalAmount: { type: Number, default: null },
      currency: { type: String, default: "INR" }, // since using Razorpay
    },

    contractFileURL: { type: String, default: null },

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
      razorpayOrderId: { type: String, default: null },
      razorpayPaymentId: { type: String, default: null },
      amountFunded: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      fundedAt: Date,
      releasedAt: Date,
      refundedAt: Date,
    },


    contractHash: String,
    lastHashVerification: Date,

    expiresAt: Date,
    autoExpireDays: { type: Number, default: null },

    status: {
      type: String,
      enum: [
        "draft",        // still being prepared
        "sent",         // sent to client
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

workProof: {
    links: [{ type: String }],
    attachments: [
      {
        url: String,
        fileType: String,
        public_id: String,
        uploadedAt: { type: Date, default: Date.now },
        submittedAt: { type: Date, default: Date.now }
      }
    ]
  }
  },
  { timestamps: true }
);

export default mongoose.model("Contract", contractSchema);
