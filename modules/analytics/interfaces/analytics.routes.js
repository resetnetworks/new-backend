// modules/analytics/interfaces/analytics.routes.js
import express from "express";
import rateLimit from "express-rate-limit";
import { authenticateUser } from "../../../middleware/authenticate.js";
import { authorizeRoles } from "../../../middleware/authorize.js";
import {
  analyticsController,
  trackClientEvent,
  getFunnelAnalytics,
  getFunnelJourney,
} from "./analytics.controller.js";

const router = express.Router();

// Specific rate limiter for analytics ingestion (allows high volume bursts)
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // up to 300 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many analytics events. Please batch your requests.",
  },
});

/**
 * @route   POST /api/v1/analytics/events
 * @desc    Ingest single or batch analytics events (playback & funnel events)
 * @access  Public / Optional Auth (Supports anonymous and authenticated events)
 */
router.post("/events", analyticsLimiter, authenticateUser, analyticsController.ingestEvents);

/**
 * @route   GET /api/v1/analytics/funnel/:artistId
 * @desc    Funnel analytics & conversion drop-off metrics for an artist or platform
 * @access  Private
 */
router.get("/funnel/:artistId", authenticateUser, getFunnelAnalytics);

/**
 * @route   GET /api/v1/analytics/journey/:funnelId
 * @desc    Inspect end-to-end event journey for a specific checkout funnelId
 * @access  Private
 */
router.get("/journey/:funnelId", authenticateUser, getFunnelJourney);

/**
 * @route   GET /api/v1/analytics/songs/:songId/stats
 * @desc    Get historical daily statistics for a song
 * @access  Private
 */
router.get("/songs/:songId/stats", authenticateUser, analyticsController.getSongStats);

/**
 * @route   GET /api/v1/analytics/artists/:artistId/stats
 * @desc    Get historical daily statistics for an artist
 * @access  Private
 */
router.get("/artists/:artistId/stats", authenticateUser, analyticsController.getArtistStats);

/* ==========================================================================
   ARTIST DASHBOARD ENDPOINTS (Artist & Admin personas)
   ========================================================================== */

/**
 * @route   GET /api/v1/analytics/artist/overview
 * @desc    Get comprehensive overview metrics for current artist
 * @access  Private (artist, admin)
 */
router.get(
  "/artist/overview",
  authenticateUser,
  authorizeRoles("artist", "admin"),
  analyticsController.getArtistOverview
);

/**
 * @route   GET /api/v1/analytics/artist/timeseries
 * @desc    Get continuous day-by-day metrics for chart plotting
 * @access  Private (artist, admin)
 */
router.get(
  "/artist/timeseries",
  authenticateUser,
  authorizeRoles("artist", "admin"),
  analyticsController.getArtistTimeseries
);

/**
 * @route   GET /api/v1/analytics/artist/top-songs
 * @desc    Get top performing songs for the artist
 * @access  Private (artist, admin)
 */
router.get(
  "/artist/top-songs",
  authenticateUser,
  authorizeRoles("artist", "admin"),
  analyticsController.getArtistTopSongs
);

/* ==========================================================================
   ADMIN DASHBOARD ENDPOINTS (Admin persona)
   ========================================================================== */

/**
 * @route   GET /api/v1/analytics/admin/overview
 * @desc    Get platform-wide traffic, playback, growth, and revenue overview
 * @access  Private (admin)
 */
router.get(
  "/admin/overview",
  authenticateUser,
  authorizeRoles("admin"),
  analyticsController.getAdminOverview
);

/**
 * @route   GET /api/v1/analytics/admin/artists-summary
 * @desc    Get ranked breakdown of artists across the platform
 * @access  Private (admin)
 */
router.get(
  "/admin/artists-summary",
  authenticateUser,
  authorizeRoles("admin"),
  analyticsController.getAdminArtistsSummary
);

/**
 * @route   GET /api/v1/analytics/admin/timeseries
 * @desc    Get platform-wide continuous day-by-day timeseries for charts
 * @access  Private (admin)
 */
router.get(
  "/admin/timeseries",
  authenticateUser,
  authorizeRoles("admin"),
  analyticsController.getAdminTimeseries
);

export default router;
