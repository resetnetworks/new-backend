import express from "express";
import { createStripeCheckout, getStripeSessionStatus } from "../controllers/payment.controller.js";
import { createSubscriptionCheckout } from "../controllers/subscription.controller.js";
import { authenticateUser } from "../../../middleware/authenticate.js";

const router = express.Router();

router.post(
  "/stripe/checkout",
  authenticateUser,
  createStripeCheckout
);

router.post("/stripe/subscription", authenticateUser, createSubscriptionCheckout);

router.get("/stripe/session-status", authenticateUser, getStripeSessionStatus);

export default router;

