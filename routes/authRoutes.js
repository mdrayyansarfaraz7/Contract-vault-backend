import express from "express";
import { register } from "../controllers/authController.js";
import upload from "../utils/upload.js";

const router = express.Router();

router.post("/register", upload.single("signature"), register);

export default router;
