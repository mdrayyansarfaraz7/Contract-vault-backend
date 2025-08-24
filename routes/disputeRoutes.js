import express from "express";
import { raiseClientDispute, raiseFreelancerDispute } from "../controllers/disputeControllers.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/disputes/:id/client-refund", verifyToken, raiseClientDispute);
router.post("/disputes/:id/freelancer", verifyToken, raiseFreelancerDispute);

export default router;