// models/Transaction.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
    },

    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    payee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "USD",
    },

    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    escrowAccountId: String, 

    status: {
      type: String,
      enum: ["initiated", "in_escrow", "released", "refunded", "failed"],
      default: "initiated",
    },

    releasedAt: Date,
    refundedAt: Date,

    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
