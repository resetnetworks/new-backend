// tests/analytics/dashboardAnalytics.test.js
import request from "supertest";
import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../../app.js";
import { analyticsService } from "../../modules/analytics/application/analytics.service.js";
import { User } from "../../models/User.js";
import { analyticsQueue } from "../../modules/analytics/infrastructure/analytics.queue.js";
import { analyticsWorker } from "../../modules/analytics/infrastructure/analytics.worker.js";

describe("Analytics Dashboard Endpoints", () => {
  const mockArtistId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockAdminId = new mongoose.Types.ObjectId().toString();

  const artistUser = {
    _id: mockUserId,
    role: "artist",
    artistId: mockArtistId,
    roleVersion: 1,
    toObject: () => ({ _id: mockUserId, role: "artist", artistId: mockArtistId, roleVersion: 1 }),
  };

  const adminUser = {
    _id: mockAdminId,
    role: "admin",
    artistId: null,
    roleVersion: 1,
    toObject: () => ({ _id: mockAdminId, role: "admin", artistId: null, roleVersion: 1 }),
  };

  const regularUser = {
    _id: new mongoose.Types.ObjectId().toString(),
    role: "user",
    artistId: null,
    roleVersion: 1,
    toObject: () => ({ role: "user", roleVersion: 1 }),
  };

  const secret = process.env.jwt_secret || "test_jwt_secret";

  const artistToken = jwt.sign(
    { id: mockUserId, role: "artist", artistId: mockArtistId, roleVersion: 1 },
    secret
  );

  const adminToken = jwt.sign(
    { id: mockAdminId, role: "admin", artistId: null, roleVersion: 1 },
    secret
  );

  const userToken = jwt.sign(
    { id: regularUser._id, role: "user", artistId: null, roleVersion: 1 },
    secret
  );

  beforeEach(() => {
    jest.spyOn(User, "findById").mockImplementation((id) => ({
      select: jest.fn().mockImplementation(() => {
        if (id === mockUserId) return Promise.resolve(artistUser);
        if (id === mockAdminId) return Promise.resolve(adminUser);
        return Promise.resolve(regularUser);
      }),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await analyticsQueue.close();
    await analyticsWorker.close();
  });

  /* ==========================================================================
     ARTIST DASHBOARD ENDPOINTS
     ========================================================================== */

  describe("Artist Dashboard Endpoints", () => {
    test("GET /api/v1/analytics/artist/overview fails without authentication (401 or 403)", async () => {
      const res = await request(app).get("/api/v1/analytics/artist/overview");
      expect([401, 403]).toContain(res.status);
    });

    test("GET /api/v1/analytics/artist/overview fails for regular user without artist/admin role (403)", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/artist/overview")
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    test("GET /api/v1/analytics/artist/overview returns overview for authenticated artist", async () => {
      const mockOverviewData = {
        range: { startDate: "2026-09-12", endDate: "2026-10-12" },
        artist: { id: mockArtistId, name: "Solar Ambient", currentFollowers: 120 },
        traffic: { profileViews: 45, uniqueProfileVisitors: 30, albumViews: 20, songViews: 100 },
        playback: { totalPlays: 500, qualifiedPlays: 400, completions: 300, skips: 50, completionRate: 60 },
        audience: { newFollowers: 15, likes: 35 },
        monetization: { revenueCents: 2500, revenueFormatted: "$25.00" },
      };

      jest.spyOn(analyticsService, "getArtistOverview").mockResolvedValue(mockOverviewData);

      const res = await request(app)
        .get("/api/v1/analytics/artist/overview?range=30d")
        .set("Authorization", `Bearer ${artistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.artist.id).toBe(mockArtistId);
      expect(res.body.data.traffic.profileViews).toBe(45);
      expect(res.body.data.playback.totalPlays).toBe(500);
    });

    test("GET /api/v1/analytics/artist/timeseries returns continuous timeseries points", async () => {
      const mockTimeseriesData = {
        range: { startDate: "2026-10-10", endDate: "2026-10-12" },
        timeseries: [
          { date: "2026-10-10", plays: 10, qualifiedPlays: 8, profileViews: 2 },
          { date: "2026-10-11", plays: 15, qualifiedPlays: 12, profileViews: 5 },
          { date: "2026-10-12", plays: 20, qualifiedPlays: 18, profileViews: 4 },
        ],
      };

      jest.spyOn(analyticsService, "getArtistTimeseries").mockResolvedValue(mockTimeseriesData);

      const res = await request(app)
        .get("/api/v1/analytics/artist/timeseries?range=7d")
        .set("Authorization", `Bearer ${artistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.timeseries).toHaveLength(3);
      expect(res.body.data.timeseries[0].date).toBe("2026-10-10");
    });

    test("GET /api/v1/analytics/artist/top-songs returns top songs breakdown", async () => {
      const mockTopSongsData = {
        range: { startDate: "2026-09-12", endDate: "2026-10-12" },
        songs: [
          { songId: "song1", title: "Morning Mist", plays: 250, qualifiedPlays: 200, completionRate: 80 },
          { songId: "song2", title: "Sunset Echoes", plays: 120, qualifiedPlays: 100, completionRate: 75 },
        ],
      };

      jest.spyOn(analyticsService, "getArtistTopSongs").mockResolvedValue(mockTopSongsData);

      const res = await request(app)
        .get("/api/v1/analytics/artist/top-songs?limit=5")
        .set("Authorization", `Bearer ${artistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.songs).toHaveLength(2);
      expect(res.body.data.songs[0].title).toBe("Morning Mist");
    });
  });

  /* ==========================================================================
     ADMIN DASHBOARD ENDPOINTS
     ========================================================================== */

  describe("Admin Dashboard Endpoints", () => {
    test("GET /api/v1/analytics/admin/overview fails for regular user and artist (403)", async () => {
      const resArtist = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${artistToken}`);
      expect(resArtist.status).toBe(403);

      const resUser = await request(app)
        .get("/api/v1/analytics/admin/overview")
        .set("Authorization", `Bearer ${userToken}`);
      expect(resUser.status).toBe(403);
    });

    test("GET /api/v1/analytics/admin/overview succeeds for admin user", async () => {
      const mockAdminOverviewData = {
        range: { startDate: "2026-09-12", endDate: "2026-10-12" },
        platformTotals: { users: 1500, artists: 85, songs: 620 },
        traffic: { landingPageViews: 8200, homePageViews: 14000, searchesPerformed: 3100 },
        userGrowth: { signupsStarted: 200, signupsCompleted: 150, signupConversionRate: 75 },
        playback: { totalPlays: 45000, qualifiedPlays: 38000, completions: 31000, skips: 4000 },
        monetization: { revenueCents: 500000, revenueFormatted: "$5000.00" },
      };

      jest.spyOn(analyticsService, "getAdminOverview").mockResolvedValue(mockAdminOverviewData);

      const res = await request(app)
        .get("/api/v1/analytics/admin/overview?range=30d")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.platformTotals.users).toBe(1500);
      expect(res.body.data.traffic.landingPageViews).toBe(8200);
      expect(res.body.data.userGrowth.signupsCompleted).toBe(150);
    });

    test("GET /api/v1/analytics/admin/artists-summary returns paginated artist rankings", async () => {
      const mockArtistsSummary = {
        range: { startDate: "2026-09-12", endDate: "2026-10-12" },
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        artists: [
          {
            artistId: mockArtistId,
            name: "Ambient Waves",
            plays: 12000,
            qualifiedPlays: 9800,
            revenueCents: 45000,
          },
        ],
      };

      jest.spyOn(analyticsService, "getAdminArtistsSummary").mockResolvedValue(mockArtistsSummary);

      const res = await request(app)
        .get("/api/v1/analytics/admin/artists-summary?page=1&limit=10&sortBy=plays")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.artists).toHaveLength(1);
      expect(res.body.data.artists[0].name).toBe("Ambient Waves");
    });

    test("GET /api/v1/analytics/admin/timeseries returns platform timeseries data", async () => {
      const mockAdminTimeseries = {
        range: { startDate: "2026-10-10", endDate: "2026-10-12" },
        timeseries: [
          { date: "2026-10-10", plays: 1500, landingPageViews: 320, signups: 8, revenueCents: 12000 },
          { date: "2026-10-11", plays: 1750, landingPageViews: 410, signups: 12, revenueCents: 18500 },
          { date: "2026-10-12", plays: 2100, landingPageViews: 500, signups: 15, revenueCents: 22000 },
        ],
      };

      jest.spyOn(analyticsService, "getAdminTimeseries").mockResolvedValue(mockAdminTimeseries);

      const res = await request(app)
        .get("/api/v1/analytics/admin/timeseries?range=7d")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.timeseries).toHaveLength(3);
      expect(res.body.data.timeseries[0].landingPageViews).toBe(320);
    });
  });
});
