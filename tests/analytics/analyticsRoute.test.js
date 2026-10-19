// tests/analytics/analyticsRoute.test.js
import request from "supertest";
import { jest } from "@jest/globals";
import app from "../../app.js";
import { eventDispatcher } from "../../modules/analytics/application/eventDispatcher.js";
import { analyticsQueue } from "../../modules/analytics/infrastructure/analytics.queue.js";
import { analyticsWorker } from "../../modules/analytics/infrastructure/analytics.worker.js";

describe("Analytics HTTP Ingestion Routes", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await analyticsQueue.close();
    await analyticsWorker.close();
  });

  test("POST /api/v1/analytics/events accepts a single event without authentication", async () => {
    jest.spyOn(eventDispatcher, "publishBatch").mockResolvedValue([
      { success: true, eventId: "test-event-single" },
    ]);

    const res = await request(app)
      .post("/api/v1/analytics/events")
      .set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")
      .set("x-anonymous-id", "anon_header_123")
      .set("x-session-id", "sess_header_456")
      .set("cf-ipcountry", "US")
      .send({
        eventName: "landing_page_viewed",
        properties: {
          referrer: "https://google.com",
        },
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(0);
    expect(res.body.results[0].eventId).toBe("test-event-single");
  });

  test("POST /api/v1/analytics/events accepts batch events", async () => {
    jest.spyOn(eventDispatcher, "publishBatch").mockResolvedValue([
      { success: true, eventId: "batch-1" },
      { success: true, eventId: "batch-2" },
    ]);

    const res = await request(app)
      .post("/api/v1/analytics/events")
      .send({
        events: [
          { eventName: "landing_page_viewed", anonymousId: "anon_1" },
          { eventName: "home_page_viewed", anonymousId: "anon_1" },
        ],
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.accepted).toBe(2);
    expect(res.body.rejected).toBe(0);
  });

  test("POST /api/v1/analytics/events returns 400 when payload is empty", async () => {
    const res = await request(app)
      .post("/api/v1/analytics/events")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("must include an event object or an 'events' array");
  });

  test("GET /api/v1/analytics/songs/:songId/stats returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/v1/analytics/songs/507f1f77bcf86cd799439011/stats");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("GET /api/v1/analytics/artists/:artistId/stats returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/v1/analytics/artists/507f1f77bcf86cd799439011/stats");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
