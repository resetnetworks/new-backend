import express from "express";
import { authenticateUser } from "../../../middleware/authenticate.js";
import { authorizeRoles } from "../../../middleware/authorize.js";
import {
  getMyReferralCodeController,
  getMyReferralsController,
} from "../controllers/referral.controller.js";

const router = express.Router();

/**
 * @route   GET /api/v2/referrals/my-code
 * @desc    Get or generate the artist's unique referral code & share link
 * @access  Authenticated (Artist)
 */
router.get(
  "/my-code",
  authenticateUser,
  authorizeRoles("artist"),
  getMyReferralCodeController
);

/**
 * @route   GET /api/v2/referrals/my-referrals
 * @desc    Get list of invited referees and their progress stages
 * @access  Authenticated (Artist)
 */
router.get(
  "/my-referrals",
  authenticateUser,
  authorizeRoles("artist"),
  getMyReferralsController
);

export default router;
