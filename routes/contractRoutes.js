import express from "express";
import { createContract } from "../controllers/contractController.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/create", verifyToken, createContract);


export default router;
