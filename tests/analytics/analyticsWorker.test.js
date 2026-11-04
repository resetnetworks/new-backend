// tests/analytics/analyticsWorker.test.js
import { jest } from "@jest/globals";
import { analyticsRepository } from "../../modules/analytics/infrastructure/analytics.repository.js";
import { eventRouter } from "../../modules/analytics/application/event-router.js";
import { analyticsWorker } from "../../modules/analytics/infrastructure/analytics.worker.js";
import { EVENT_TYPES } from "../../modules/analytics/domain/event.types.js";

describe("Analytics Worker Job Processing", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await analyticsWorker.close();
  });

  test("processes new unique event and triggers derived event router", async () => {
    const saveRawSpy = jest.spyOn(analyticsRepository, "saveRawEvent").mockResolvedValue({
      event: { eventId: "evt-worker-1" },
      isDuplicate: false,
    });
    const routeSpy = jest.spyOn(eventRouter, "route").mockResolvedValue();

    const job = {
      data: {
        eventId: "evt-worker-1",
        eventName: EVENT_TYPES.PLAYBACK_STARTED,
        userId: "507f1f77bcf86cd799439011",
      },
    };

    // The processor function passed to BullMQ Worker
    const processor = analyticsWorker.processFn;
    const result = await processor(job);

    expect(result).toEqual({ status: "processed", eventId: "evt-worker-1" });
    expect(saveRawSpy).toHaveBeenCalledWith(job.data);
    expect(routeSpy).toHaveBeenCalledWith(job.data);
  });

  test("gracefully skips derived routing if event is a duplicate (E11000 idempotency)", async () => {
    const saveRawSpy = jest.spyOn(analyticsRepository, "saveRawEvent").mockResolvedValue({
      event: null,
      isDuplicate: true,
    });
    const routeSpy = jest.spyOn(eventRouter, "route").mockResolvedValue();

    const job = {
      data: {
        eventId: "evt-duplicate-123",
        eventName: EVENT_TYPES.PLAYBACK_30S,
        userId: "507f1f77bcf86cd799439011",
      },
    };

    const processor = analyticsWorker.processFn;
    const result = await processor(job);

    expect(result).toEqual({ status: "duplicate_skipped", eventId: "evt-duplicate-123" });
    expect(saveRawSpy).toHaveBeenCalledWith(job.data);
    expect(routeSpy).not.toHaveBeenCalled();
  });
});
