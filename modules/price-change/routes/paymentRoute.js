import express from "express";
import { authenticateUser } from "../../../middleware/authenticate.js";
import { authorizeRoles } from "../../../middleware/authorize.js";
import { injectWorkspaceContext } from "../../../middleware/injectWorkspaceContext.js";
import { updateGlobalPricing } from "../controllers/paymentController.js";

const router = express.Router();

// ✅ NEW: Update pricing globally (Stripe, PayPal, Razorpay)
router.put(
  "/subscription-price",
  authenticateUser,
  injectWorkspaceContext("changeSubscriptionPrice"),
  authorizeRoles("artist"),
  updateGlobalPricing
);

export default router;
