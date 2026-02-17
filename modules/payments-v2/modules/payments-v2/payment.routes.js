import express from "express";
import { createPaymentIntent } from "./payment.controller.js";
import { handleWebhook } from "./webhook.controller.js";
import { authenticateUser } from "../../../../middleware/authenticate.js"; 
// adjust path based on your project

const router = express.Router();

/* ---------------------------------------
   Payment Intent Creation (Protected)
--------------------------------------- */
router.post(
  "/",
  authenticateUser,
  createPaymentIntent
);

/* ---------------------------------------
   Webhooks (Raw body required)
--------------------------------------- */
router.post(
  "/webhooks/:provider",
  express.raw({ type: "*/*" }),  // critical for signature verification
  handleWebhook
);

export default router;
