// controllers/authController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";

export const register = async (req, res) => {
  try {
    const { username, email, password, role, payoutDetails, companyName } = req.body;

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already in use" });

    let payout = {};
    if (role === "freelancer") {
      const payoutData = payoutDetails || {};

      payout = {
        accountHolderName: payoutData.accountHolderName?.trim(),
        accountNumber: payoutData.accountNumber?.trim(),
        ifscCode: payoutData.ifscCode?.trim(),
        upiId: payoutData.upiId?.trim(),
      };

      if (!payout.accountHolderName || !payout.accountNumber || !payout.ifscCode) {
        return res.status(400).json({ message: "Freelancer must provide payout details" });
      }
    }

    if (role === "client" && (!companyName || companyName.trim() === "")) {
      return res.status(400).json({ message: "Client must provide a company name" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle signature upload
    let signatureData = {};
    if (req.file && req.file.path) {
      signatureData.imageURL = req.file.path;
      signatureData.hash = crypto.createHash("sha256").update(req.file.path).digest("hex");
    }

    // Role-specific profile
    let profile = {};
    if (role === "client") {
      profile.companyName = companyName;
    }

    // Generate 6-digit email verification token
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role,
      signature: signatureData,
      profile,
      payoutDetails: payout,
      verificationToken,
      verificationTokenExpiry,
    });

    await user.save();

    // Email template
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
          <table width="100%" style="max-width: 600px; margin: auto; background: #fff; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background: #2ecc71; padding: 15px; text-align: center; color: white; font-size: 20px; font-weight: bold;">
                Contract Vault
              </td>
            </tr>
            <tr>
              <td style="padding: 30px; color: #333;">
                <h2 style="color: #2ecc71;">Verify Your Email</h2>
                <p style="font-size: 15px;">
                  Thank you for registering with <b>Contract Vault</b>!  
                  Please use the verification token below to verify your email:
                </p>
                <div style="margin: 25px 0; text-align: center;">
                  <span style="display: inline-block; background: #2ecc71; color: #fff; font-size: 18px; font-weight: bold; padding: 12px 20px; border-radius: 5px;">
                    ${verificationToken}
                  </span>
                </div>
                <p style="font-size: 14px;">
                  This token will expire in <b>1 hour</b>.  
                  If you did not create an account, please ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #555;">
                © ${new Date().getFullYear()} Contract Vault. All rights reserved.
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    await sendEmail(email, "Verify your Contract Vault account", html);

    res.status(201).json({
      message: "User registered successfully. Please check your email for verification token.",
    });
  } catch (err) {
    console.error(" Register Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
