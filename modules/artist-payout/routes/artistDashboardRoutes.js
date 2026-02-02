import express from "express";
import {
  getArtistBalance,
  getArtistLedger,
  getArtistPayouts,
} from "../controllers/artistDashboardController.js";

import { authenticateUser } from "../../../middleware/authenticate.js";
import { authorizeRoles } from "../../../middleware/authorize.js";

const router = express.Router();

router.get("/balance", authenticateUser, authorizeRoles("artist"), getArtistBalance);
router.get("/ledger", authenticateUser, authorizeRoles("artist"), getArtistLedger);
router.get("/payouts", authenticateUser, authorizeRoles("artist"), getArtistPayouts);

export default router;
