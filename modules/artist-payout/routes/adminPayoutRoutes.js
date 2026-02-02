import express from "express";
import {
  getPendingPayouts,
  markPayoutAsPaid,
} from "../controllers/adminPayoutController.js";

import { authenticateUser } from "../../../middleware/authenticate.js";
import { authorizeRoles } from "../../../middleware/authorize.js";

const router = express.Router();

router.get(
  "/payouts",
  authenticateUser,
  authorizeRoles("admin"),
  getPendingPayouts
);

router.post(
  "/payouts/:payoutId/mark-paid",
  authenticateUser,
  authorizeRoles("admin"),
  markPayoutAsPaid
);

export default router;
