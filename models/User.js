// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: ["freelancer", "client"],
      default: "freelancer",
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    profile: {
      fullName: { type: String, trim: true },
      companyName: { type: String, trim: true }, // Optional for agencies/clients
      phoneNumber: { type: String, trim: true },
      address: { type: String, trim: true },
      country: { type: String, trim: true },
    },

    signature: {
      imageURL: { type: String, default: null },
      hash: { type: String, default: null },     
    },

    payoutDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      upiId: { type: String, trim: true }, 
    },
    contracts:[{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Contract",
    }],
    verificationToken: String,
    verificationTokenExpiry: Date,
    resetPasswordToken: String,
    resetPasswordExpiry: Date,

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
