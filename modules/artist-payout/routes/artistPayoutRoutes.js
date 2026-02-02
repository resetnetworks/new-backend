import express from "express";
import { requestPayout } from "../controllers/artistPayoutController.js";
import { authenticateUser } from "../../../middleware/authenticate.js";
import { authorizeRoles } from "../../../middleware/authorize.js";

const router = express.Router();

router.post(
  "/payouts/request",
  authenticateUser,
  authorizeRoles("artist"),
  requestPayout
);

export default router;
