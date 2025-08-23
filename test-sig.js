import crypto from "crypto";
import dotenv from 'dotenv';

dotenv.config();

const orderId = "order_R8jBA5E2XmPTFc"; // from DB
const paymentId = "pay_test_123456";    // any string for test
const signature = crypto
  .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
  .update(orderId + "|" + paymentId)
  .digest("hex");

console.log({ orderId, paymentId, signature });