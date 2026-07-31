import express from "express";
import { authenticateUser } from "../../../middleware/authenticate.js";
import {
  getOAuthUrl,
  handleOAuthCallback,
  getAvailablePages,
  selectPage,
  getConnectionStatus,
  disconnect,
} from "../controllers/auth.controller.js";

const router = express.Router();

// -------------------------------------------------------
// Facebook Page OAuth — Authorization Layer
// NOTE: Role check removed for testing — any logged-in user can use this.
// Add authorizeRoles("artist") back before going to production.
// -------------------------------------------------------

// Generate Facebook OAuth URL
router.get("/auth/url", authenticateUser, getOAuthUrl);

// OAuth callback — Facebook redirects here (no auth — identified via Redis state)
router.get("/auth/callback", handleOAuthCallback);

// Get available pages after OAuth callback
router.get("/auth/pages", authenticateUser, getAvailablePages);

// Select which Facebook Page to use
router.post("/auth/select-page", authenticateUser, selectPage);

// Check connection status
router.get("/auth/status", authenticateUser, getConnectionStatus);

// Disconnect Facebook Page
router.delete("/auth/disconnect", authenticateUser, disconnect);

export default router;
