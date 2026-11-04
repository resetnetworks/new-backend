// tests/analytics/funnelAnalytics.test.js
import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { analyticsRepository } from "../../modules/analytics/infrastructure/analytics.repository.js";
import { analyticsService } from "../../modules/analytics/application/analytics.service.js";
import { analyticsProducer } from "../../modules/analytics/infrastructure/analytics.producer.js";
import { AnalyticsEvent } from "../../modules/analytics/domain/models/AnalyticsEvent.js";
import { CheckoutAttempt } from "../../modules/analytics/domain/models/CheckoutAttempt.js";
import { ANALYTICS_EVENTS, CHECKOUT_ATTEMPT_STATUS } from "../../modules/analytics/domain/analytics.constants.js";
import { getFunnelAnalytics } from "../../modules/analytics/interfaces/analytics.controller.js";
import { analyticsQueue } from "../../modules/analytics/infrastructure/analytics.queue.js";
import { analyticsWorker } from "../../modules/analytics/infrastructure/analytics.worker.js";

describe("Funnel Analytics & Payment Abandoned Pipeline", () => {
  const mockArtistId = new mongoose.Types.ObjectId().toString();
  const mockUserId = new mongoose.Types.ObjectId().toString();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    try {
      await analyticsQueue.close();
      await analyticsWorker.close();
    } catch {}
  });

  describe("analyticsRepository.getFunnelStats - Abandoned Event Counting", () => {
    test("correctly increments payment_abandoned count when multiple events are captured with the same funnelId", async () => {
      // Simulate MongoDB aggregate output when 2 events exist for the same funnel
      jest.spyOn(AnalyticsEvent, "aggregate").mockResolvedValue([
        {
          _id: ANALYTICS_EVENTS.CHECKOUT_STARTED,
          totalEvents: 2,
          uniqueFunnelsCount: 1,
          uniqueUsersCount: 1,
        },
        {
          _id: ANALYTICS_EVENTS.PAYMENT_ABANDONED,
          totalEvents: 2,
          uniqueFunnelsCount: 1,
          uniqueUsersCount: 1,
        },
      ]);

      const stats = await analyticsRepository.getFunnelStats({ artistId: mockArtistId });

      // Verifies that total count changes to 2 instead of being stuck at unique funnels (1)
      expect(stats.funnelCounts.payment_abandoned).toBe(2);
      expect(stats.totalCounts.payment_abandoned).toBe(2);
      expect(stats.totalAbandoned).toBe(2);
      expect(stats.totalAbandonedEvents).toBe(2);
      expect(stats.dropOffs.paymentAbandoned).toBe(2);
      expect(stats.uniqueCounts.payment_abandoned).toBe(1);
    });

    test("correctly handles events captured with null or empty funnelId", async () => {
      // When events have no funnelId, totalEvents is counted and uniqueFunnels is 0 (not 1 from [null])
      jest.spyOn(AnalyticsEvent, "aggregate").mockResolvedValue([
        {
          _id: ANALYTICS_EVENTS.PAYMENT_ABANDONED,
          totalEvents: 5,
          uniqueFunnelsCount: 0,
          uniqueUsersCount: 2,
        },
      ]);

      const stats = await analyticsRepository.getFunnelStats({ artistId: mockArtistId });

      expect(stats.funnelCounts.payment_abandoned).toBe(5);
      expect(stats.totalCounts.payment_abandoned).toBe(5);
      expect(stats.totalAbandoned).toBe(5);
      expect(stats.uniqueCounts.payment_abandoned).toBe(0);
    });

    test("gracefully handles 'all', 'platform', and invalid ObjectId without throwing errors", async () => {
      const aggSpy = jest.spyOn(AnalyticsEvent, "aggregate").mockResolvedValue([]);

      const statsPlatform = await analyticsRepository.getFunnelStats({ artistId: "platform" });
      expect(statsPlatform.artistId).toBe("platform");

      const statsAll = await analyticsRepository.getFunnelStats({ artistId: "all" });
      expect(statsAll.artistId).toBe("platform");

      const statsInvalid = await analyticsRepository.getFunnelStats({ artistId: "invalid-id-xyz" });
      expect(statsInvalid.artistId).toBe("platform");

      expect(aggSpy).toHaveBeenCalledTimes(3);
    });

    test("correctly applies date filtering with end-of-day boundaries", async () => {
      let capturedMatch = null;
      jest.spyOn(AnalyticsEvent, "aggregate").mockImplementation((pipeline) => {
        capturedMatch = pipeline[0].$match;
        return Promise.resolve([]);
      });

      await analyticsRepository.getFunnelStats({
        artistId: mockArtistId,
        startDate: "2026-11-01",
        endDate: "2026-11-02",
      });

      expect(capturedMatch).toBeDefined();
      expect(capturedMatch.occurredAt.$gte).toEqual(new Date("2026-11-01T00:00:00.000Z"));
      expect(capturedMatch.occurredAt.$lte).toEqual(new Date("2026-11-02T23:59:59.999Z"));
    });
  });

  describe("analyticsService.abandonPaymentFunnel", () => {
    test("marks checkout attempt as abandoned and publishes payment_abandoned event", async () => {
      const updateAttemptSpy = jest
        .spyOn(analyticsRepository, "updateCheckoutAttemptStatus")
        .mockResolvedValue({});
      const publishSpy = jest.spyOn(analyticsProducer, "publishEvent").mockResolvedValue({});

      await analyticsService.abandonPaymentFunnel({
        funnelId: "funnel-abandon-1",
        gatewaySessionId: "sess-123",
        userId: mockUserId,
        artistId: mockArtistId,
        planId: "1m",
        reason: "checkout_session_expired",
      });

      expect(updateAttemptSpy).toHaveBeenCalledWith("funnel-abandon-1", {
        status: CHECKOUT_ATTEMPT_STATUS.ABANDONED,
        abandonedAt: expect.any(Date),
        failureReason: "checkout_session_expired",
      });

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: ANALYTICS_EVENTS.PAYMENT_ABANDONED,
          eventType: ANALYTICS_EVENTS.PAYMENT_ABANDONED,
          funnelId: "funnel-abandon-1",
          artistId: mockArtistId,
        })
      );
    });
  });

  describe("analyticsService.checkAndAbandonPayment", () => {
    test("reconciles pending attempt and marks as abandoned", async () => {
      const mockAttempt = {
        _id: new mongoose.Types.ObjectId(),
        funnelId: "funnel-timeout-1",
        userId: mockUserId,
        artistId: mockArtistId,
        status: CHECKOUT_ATTEMPT_STATUS.PENDING,
      };

      jest.spyOn(analyticsRepository, "findCheckoutAttemptById").mockResolvedValue(mockAttempt);
      const updateSpy = jest
        .spyOn(analyticsRepository, "updateCheckoutAttemptStatus")
        .mockResolvedValue({ ...mockAttempt, status: CHECKOUT_ATTEMPT_STATUS.ABANDONED });
      const publishSpy = jest.spyOn(analyticsProducer, "publishEvent").mockResolvedValue({});

      const result = await analyticsService.checkAndAbandonPayment(mockAttempt._id);

      expect(updateSpy).toHaveBeenCalledWith(mockAttempt._id, {
        status: CHECKOUT_ATTEMPT_STATUS.ABANDONED,
        abandonedAt: expect.any(Date),
        failureReason: "checkout_timeout_no_payment",
      });
      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: ANALYTICS_EVENTS.PAYMENT_ABANDONED,
          funnelId: "funnel-timeout-1",
        })
      );
      expect(result.status).toBe(CHECKOUT_ATTEMPT_STATUS.ABANDONED);
    });
  });

  describe("getFunnelAnalytics Controller Endpoint", () => {
    test("returns 200 with total payment abandoned metrics", async () => {
      const mockMetrics = {
        artistId: mockArtistId,
        period: { startDate: "2026-10-01", endDate: "2026-11-01" },
        funnelCounts: {
          subscription_clicked: 10,
          checkout_started: 8,
          payment_initiated: 6,
          payment_completed: 4,
          payment_failed: 1,
          payment_abandoned: 3,
          subscription_activated: 4,
        },
        totalCounts: {
          payment_abandoned: 3,
        },
        totalAbandoned: 3,
        totalAbandonedEvents: 3,
        conversionRates: {
          overallConversionRate: 40,
        },
        dropOffs: {
          paymentAbandoned: 3,
        },
      };

      jest.spyOn(analyticsService, "getFunnelMetrics").mockResolvedValue(mockMetrics);

      const req = {
        params: { artistId: mockArtistId },
        query: { range: "30d" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getFunnelAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockMetrics,
      });
      expect(res.json.mock.calls[0][0].data.funnelCounts.payment_abandoned).toBe(3);
      expect(res.json.mock.calls[0][0].data.totalAbandoned).toBe(3);
      expect(res.json.mock.calls[0][0].data.dropOffs.paymentAbandoned).toBe(3);
    });
  });
});
