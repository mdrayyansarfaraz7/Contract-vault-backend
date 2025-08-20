import express from "express";
import { acceptContractCreatOrderPayment, createContract, rejectContract, successfullPayment } from "../controllers/contractController.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/create", verifyToken, createContract);
router.post("/:id/accept",verifyToken,acceptContractCreatOrderPayment);
router.post("/:id/payment-successful",verifyToken,successfullPayment);
router.post("/:id/reject",verifyToken,rejectContract);

export default router;
