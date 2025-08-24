// controllers/authController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import sendEmail from "../utils/sendEmail.js";
import jwt from "jsonwebtoken"
import Contract from "../models/Contract.js";

export const register = async (req, res) => {
  try {
    const { username,fullName, email, password, role, payoutDetails, companyName } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already in use" });

    let payout = {};

    const payoutData = payoutDetails || {};

    payout = {
      accountHolderName: payoutData.accountHolderName?.trim(),
      accountNumber: payoutData.accountNumber?.trim(),
      ifscCode: payoutData.ifscCode?.trim(),
      upiId: payoutData.upiId?.trim(),
    };


    if (!payout.accountHolderName || !payout.accountNumber || !payout.ifscCode) {
      return res.status(400).json({ message: `${role} must provide payout details` });
    }

    if (role === "client" && (!companyName || companyName.trim() === "")) {
      return res.status(400).json({ message: "Client must provide a company name" });
    }

    if (role === "client" && (!companyName || companyName.trim() === "")) {
      return res.status(400).json({ message: "Client must provide a company name" });
    }


    const hashedPassword = await bcrypt.hash(password, 10);
    let signatureData = {};
    if (req.file && req.file.path) {
      signatureData.imageURL = req.file.path;
      signatureData.hash = crypto.createHash("sha256").update(req.file.path).digest("hex");
    }

    let profile = {};
    if (role === "client") {
      profile.companyName = companyName;
    }

    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationTokenExpiry = Date.now() + 1000 * 60 * 60; 

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role,
      profile:{
        fullName,
      },
      signature: signatureData,
      profile,
      payoutDetails: payout,
      verificationToken,
      verificationTokenExpiry,
    });

        if (role === "client") {
      const contracts = await Contract.find({ clientEmail: email }).select("_id");
      if (contracts.length > 0) {
        user.contracts = contracts.map(c => c._id);
      }
    }

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

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password").populate('contracts');

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isEmailVerified) {
      return res.status(400).json({ message: "Please verify your email first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, username:user.username ,role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, { httpOnly: true, secure: false }); // set secure: true in prod
    res.json({ message: "Login successful", token ,  user});
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const logout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, token } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "Already verified" });

    if (user.verificationToken !== token || user.verificationTokenExpiry < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = Date.now() + 1000 * 60 * 15; // 15 min
    await user.save();
const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
    <table width="100%" style="max-width: 600px; margin: auto; background: #fff; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
      <tr>
        <td style="background: #27ae60; padding: 15px; text-align: center; color: white; font-size: 20px; font-weight: bold;">
          Contract Vault
        </td>
      </tr>
      <tr>
        <td style="padding: 30px; color: #333;">
          <h2 style="color: #27ae60; margin-bottom: 10px;">Password Reset Request</h2>
          <p style="font-size: 15px;">
            We received a request to reset your password.  
            Please use the token below to proceed:
          </p>
          <div style="margin: 25px 0; text-align: center;">
            <span style="display: inline-block; background: #27ae60; color: #fff; font-size: 20px; font-weight: bold; padding: 12px 24px; border-radius: 6px; letter-spacing: 2px;">
              ${resetToken}
            </span>
          </div>
          <p style="font-size: 14px; line-height: 1.5;">
            ⚠️ This token will expire in <b>1 hour</b>.  
            If you didn’t request a password reset, please ignore this email.
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
    // send email
    await sendEmail(
      email,
      "Reset your Contract Vault password",
      html
    );

    res.json({ message: "Password reset token sent to email" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.resetPasswordToken !== token || user.resetPasswordExpiry < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const sendVerificationCode = async (req, res) => {
  const { email } = req.body;

  console.log("Received email:", email);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(404).json({ message: "User not found" });
    }
    console.log(user);
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000);
    console.log("Generated verification code:", code);

    // Save code & expiry to user
    user.verificationToken = code.toString();
    user.verificationTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes expiry
    await user.save();
    console.log("Saved code and expiry to user");

    // Professional green HTML template
    const html = `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
        <div style="display: inline-block; background-color: #e6ffe6; padding: 30px; border-radius: 10px; border: 1px solid #b3ffb3;">
          <h2 style="color: #2d7a2d;">Email Verification</h2>
          <p style="font-size: 16px;">Use the following code to verify your email:</p>
          <p style="font-size: 24px; font-weight: bold; color: #1a4d1a;">${code}</p>
          <p style="font-size: 14px; color: #333;">This code will expire in 15 minutes.</p>
        </div>
      </div>
    `;

    // Send email
    await sendEmail(email, "Your Email Verification Code", html);
    console.log("Verification email sent to:", email);

    res.status(200).json({ message: "Verification code sent" });
  } catch (error) {
    console.error("Error sending verification code:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getMe = async (req, res) => {
  try {
    
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.status(200).json({ user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}; 
