import express from "express";
import { authenticateUser } from "../middleware/authenticate.js";
import { getArtistDashboardAlbums, getArtistDashboardSongs, getArtistDashboardStats } from "../controllers/artistDashboardController.js";
import { authorizeRoles } from "../middleware/authorize.js";
import { injectWorkspaceContext } from "../middleware/injectWorkspaceContext.js";

const router = express.Router();




// Get all singles per artist
router.get("/singles", authenticateUser, injectWorkspaceContext(), authorizeRoles("artist"), getArtistDashboardSongs);

// Get all albums per artist
router.get("/albums", authenticateUser, injectWorkspaceContext(), authorizeRoles("artist"), getArtistDashboardAlbums);

// Get artist stats
router.get("/stats", authenticateUser, injectWorkspaceContext("viewAnalytics"), authorizeRoles("artist"), getArtistDashboardStats);

export default router;