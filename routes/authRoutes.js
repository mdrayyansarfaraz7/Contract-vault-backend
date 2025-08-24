import express from "express";
import upload from "../utils/upload.js";
import {
  register,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  sendVerificationCode,
  getMe,
} from "../controllers/authController.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

// Register route (with optional file upload for signature)
router.post("/register", upload.single("signature"), register);

// Login route
router.post("/login", login);

// Logout route
router.post("/logout", logout);

router.get("/me", verifyToken, getMe);

router.post("/verify-email", verifyEmail);

// Forgot password route
router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);

router.post("/send-verification-code", sendVerificationCode);

export default router;
