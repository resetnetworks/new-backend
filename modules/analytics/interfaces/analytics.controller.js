// modules/analytics/interfaces/analytics.controller.js
import crypto from "crypto";
import { StatusCodes } from "http-status-codes";
import { eventDispatcher } from "../application/eventDispatcher.js";
import { analyticsService } from "../application/analytics.service.js";
import { MAX_BATCH_EVENT_SIZE } from "../domain/analytics.constants.js";

/**
 * Infer device type, browser, and OS from User-Agent header
 */
const parseUserAgent = (userAgent = "") => {
  const ua = userAgent.toLowerCase();
  let deviceType = "desktop";
  let operatingSystem = "unknown";
  let browser = "unknown";

  // Device
  if (/mobile|iphone|ipod|android.*mobile|blackberry|windows phone/i.test(ua)) {
    deviceType = "mobile";
  } else if (/ipad|tablet|android(?!.*mobile)/i.test(ua)) {
    deviceType = "tablet";
  }

  // OS
  if (/windows/i.test(ua)) operatingSystem = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) operatingSystem = "macOS";
  else if (/android/i.test(ua)) operatingSystem = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) operatingSystem = "iOS";
  else if (/linux/i.test(ua)) operatingSystem = "Linux";

  // Browser
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";

  return { deviceType, operatingSystem, browser };
};

/**
 * Hash IP address for privacy-preserving unique counts
 */
const hashIp = (ip = "") => {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
};

export const analyticsController = {
  /**
   * POST /api/v1/analytics/events
   * Accepts a single event or a batch: { events: [...] }
   */
  async ingestEvents(req, res) {
    try {
      const rawEvents = Array.isArray(req.body.events)
        ? req.body.events
        : req.body.eventName
        ? [req.body]
        : [];

      if (rawEvents.length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Request must include an event object or an 'events' array",
        });
      }

      if (rawEvents.length > MAX_BATCH_EVENT_SIZE) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: `Batch exceeds maximum limit of ${MAX_BATCH_EVENT_SIZE} events`,
        });
      }

      // Extract client network & device hints from request headers
      const userAgent = req.headers["user-agent"] || "";
      const { deviceType, operatingSystem, browser } = parseUserAgent(userAgent);
      const rawCountry = req.headers["cf-ipcountry"] || req.headers["x-country-code"] || null;
      const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
      const ipHash = hashIp(clientIp);

      const headerAnonymousId = req.headers["x-anonymous-id"] || null;
      const headerSessionId = req.headers["x-session-id"] || null;
      const authenticatedUserId = req.user?._id || null;

      // Enrich events with server-side context where missing
      const enrichedEvents = rawEvents.map((ev) => {
        const existingContext = ev.context || {};
        const existingProperties = ev.properties || {};
        return {
          ...ev,
          userId: ev.userId || authenticatedUserId,
          anonymousId: ev.anonymousId || headerAnonymousId || null,
          sessionId: ev.sessionId || headerSessionId || null,
          properties: {
            ...existingProperties,
            userEmail: req.user?.email || existingProperties.userEmail || null,
          },
          context: {
            country: existingContext.country || rawCountry,
            region: existingContext.region || null,
            city: existingContext.city || null,
            deviceType: existingContext.deviceType || deviceType,
            operatingSystem: existingContext.operatingSystem || operatingSystem,
            browser: existingContext.browser || browser,
            platform: existingContext.platform || "web",
            ipHash: existingContext.ipHash || ipHash,
          },
        };
      });

      // Dispatch to asynchronous BullMQ queue
      const results = await eventDispatcher.publishBatch(enrichedEvents);
      const accepted = results.filter((r) => r.success).length;
      const rejected = results.filter((r) => !r.success).length;

      return res.status(StatusCodes.ACCEPTED).json({
        success: true,
        accepted,
        rejected,
        results: results.map((r) => ({
          success: r.success,
          eventId: r.eventId,
          error: r.error,
        })),
      });
    } catch (err) {
      console.error("[AnalyticsController] Ingestion error:", err);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to ingest analytics events",
      });
    }
  },

  /**
   * GET /api/v1/analytics/songs/:songId/stats
   */
  async getSongStats(req, res) {
    try {
      if (!req.user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: "Authentication required to access statistics",
        });
      }

      const { songId } = req.params;
      const { startDate, endDate, limit } = req.query;
      const stats = await analyticsService.getSongStats(songId, {
        startDate,
        endDate,
        limit: limit ? parseInt(limit, 10) : 30,
      });

      return res.status(StatusCodes.OK).json({ success: true, data: stats });
    } catch (err) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err.message,
      });
    }
  },

  /**
   * GET /api/v1/analytics/artists/:artistId/stats
   */
  async getArtistStats(req, res) {
    try {
      if (!req.user) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: "Authentication required to access statistics",
        });
      }

      const artistId = req.params.artistId || req.user?.artistId;
      if (!artistId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "artistId is required",
        });
      }

      const { startDate, endDate, limit } = req.query;
      const stats = await analyticsService.getArtistStats(artistId, {
        startDate,
        endDate,
        limit: limit ? parseInt(limit, 10) : 30,
      });

      return res.status(StatusCodes.OK).json({ success: true, data: stats });
    } catch (err) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err.message,
      });
    }
  },

  /**
   * Helper to resolve artistId based on role and request
   */
  resolveArtistId(req) {
    const userRole = req.user?.role;
    const isAdmin = Array.isArray(userRole) ? userRole.includes("admin") : userRole === "admin";
    if (isAdmin && req.query.artistId) {
      return req.query.artistId;
    }
    return req.user?.artistId || null;
  },

  /**
   * GET /api/v1/analytics/artist/overview
   * Scoped to current artist (or artist specified by admin via query param)
   */
  async getArtistOverview(req, res) {
    try {
      const artistId = analyticsController.resolveArtistId(req);
      if (!artistId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "No artist profile associated with this account or artistId missing",
        });
      }

      const data = await analyticsService.getArtistOverview(artistId, req.query);
      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      console.error("[AnalyticsController] getArtistOverview error:", err);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err.message || "Failed to load artist overview",
      });
    }
  },

  /**
   * GET /api/v1/analytics/artist/timeseries
   * Returns continuous date-by-date metrics for artist dashboard charts
   */
  async getArtistTimeseries(req, res) {
    try {
      const artistId = analyticsController.resolveArtistId(req);
      if (!artistId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "No artist profile associated with this account or artistId missing",
        });
      }

      const data = await analyticsService.getArtistTimeseries(artistId, req.query);
      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      console.error("[AnalyticsController] getArtistTimeseries error:", err);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err.message || "Failed to load artist timeseries",
      });
    }
  },

  /**
   * GET /api/v1/analytics/artist/top-songs
   * Returns top performing songs for the artist
   */
  async getArtistTopSongs(req, res) {
    try {
      const artistId = analyticsController.resolveArtistId(req);
      if (!artistId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "No artist profile associated with this account or artistId missing",
        });
      }

      const data = await analyticsService.getArtistTopSongs(artistId, req.query);
      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      console.error("[AnalyticsController] getArtistTopSongs error:", err);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err.message || "Failed to load top songs",
      });
    }
  },

  /**
   * GET /api/v1/analytics/admin/overview
   * Platform-wide high-level metrics
   */
  async getAdminOverview(req, res) {
    try {
      const data = await analyticsService.getAdminOverview(req.query);
      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      console.error("[AnalyticsController] getAdminOverview error:", err);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err.message || "Failed to load admin overview",
      });
    }
  },

  /**
   * GET /api/v1/analytics/admin/artists-summary
   * Platform-wide artist rankings and breakdowns
   */
  async getAdminArtistsSummary(req, res) {
    try {
      const data = await analyticsService.getAdminArtistsSummary(req.query);
      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      console.error("[AnalyticsController] getAdminArtistsSummary error:", err);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err.message || "Failed to load artists summary",
      });
    }
  },

  /**
   * GET /api/v1/analytics/admin/timeseries
   * Platform-wide continuous date-by-date timeseries for admin charts
   */
  async getAdminTimeseries(req, res) {
    try {
      const data = await analyticsService.getAdminTimeseries(req.query);
      return res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      console.error("[AnalyticsController] getAdminTimeseries error:", err);
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: err.message || "Failed to load admin timeseries",
      });
    }
  },
};
