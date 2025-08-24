import express from "express";
import { acceptContractCreatOrderPayment, approveContract, createContract, rejectContract, sendContract, submitWorkProof, successfullPayment } from "../controllers/contractController.js";
import verifyToken from "../middleware/verifyToken.js";
import upload from "../utils/upload.js";

const router = express.Router();
router.get('/:id',verifyToken,sendContract);
router.post("/create", verifyToken, createContract);
router.post("/:id/accept", verifyToken, acceptContractCreatOrderPayment);
router.post("/:id/payment-successful", verifyToken, successfullPayment);
router.post("/:id/reject", verifyToken, rejectContract);
router.post(
  "/work-submitted/:id",
  verifyToken,
  upload.fields([
    { name: "attachments", maxCount: 5 },
    { name: "links" },
  ]),
  submitWorkProof
);
router.patch("/:id/approve",verifyToken, approveContract);

export default router;
