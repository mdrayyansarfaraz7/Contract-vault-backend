import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    // Which contract this transaction belongs to
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
    },

    // Who paid the money (usually client)
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Who will ultimately receive the money (usually freelancer/agency)
    payee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // What kind of transaction this is
    type: {
      type: String,
      enum: ["escrow-funding", "payout", "refund"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR", // since you’re using Razorpay
    },

    // Razorpay integration
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,

    // Escrow tracking
    escrowAccountId: String, 
    status: {
      type: String,
      enum: ["initiated", "pending", "in_escrow", "released", "refunded", "failed"],
      default: "initiated",
    },

    fundedAt: Date,    
    releasedAt: Date,   
    refundedAt: Date,   

    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
