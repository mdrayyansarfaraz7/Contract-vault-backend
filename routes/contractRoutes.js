import express from "express";
import { acceptContractCreatOrderPayment, approveContract, createContract, rejectContract, submitWorkProof, successfullPayment } from "../controllers/contractController.js";
import verifyToken from "../middleware/verifyToken.js";
import upload from "../utils/upload.js";

const router = express.Router();

router.post("/create", verifyToken, createContract);
router.post("/:id/accept", verifyToken, acceptContractCreatOrderPayment);
router.post("/:id/payment-successful", verifyToken, successfullPayment);
router.post("/:id/reject", verifyToken, rejectContract);
router.post("/work-submitted/:id",verifyToken,upload.array("attachments", 5),submitWorkProof);
router.patch("/:id/approve",verifyToken, approveContract);

export default router;
