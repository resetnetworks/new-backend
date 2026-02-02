import express from "express";
import { authenticateUser } from "../middleware/authenticate.js";
import { getArtistDashboardAlbums, getArtistDashboardSongs, getArtistDashboardStats } from "../controllers/artistDashboardController.js";
import { authorizeRoles } from "../middleware/authorize.js";

const router = express.Router();




// Get all singles per artist 
router.get("/singles", authenticateUser, authorizeRoles("artist"), getArtistDashboardSongs);

// Get all albums per artist
router.get("/albums", authenticateUser, authorizeRoles("artist"), getArtistDashboardAlbums);

// Get artist stats
router.get("/stats", authenticateUser, authorizeRoles("artist"), getArtistDashboardStats);

export default router;
