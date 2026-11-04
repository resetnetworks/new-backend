// tests/analytics/eventDispatcher.test.js
import { jest } from "@jest/globals";
import { eventDispatcher } from "../../modules/analytics/application/eventDispatcher.js";
import { analyticsQueue } from "../../modules/analytics/infrastructure/analytics.queue.js";
import { EVENT_TYPES } from "../../modules/analytics/domain/event.types.js";

describe("Event Dispatcher", () => {
  const validMongoId = "507f1f77bcf86cd799439011";

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await analyticsQueue.close();
  });

  test("publishes event and enqueues with jobId equal to eventId", async () => {
    const queueAddSpy = jest.spyOn(analyticsQueue, "add").mockResolvedValue({ id: "job-1" });

    const result = await eventDispatcher.publish({
      eventId: "custom-event-uuid-1",
      eventName: EVENT_TYPES.PLAYBACK_STARTED,
      userId: validMongoId,
      songId: validMongoId,
    });

    expect(result.success).toBe(true);
    expect(result.eventId).toBe("custom-event-uuid-1");

    expect(queueAddSpy).toHaveBeenCalledTimes(1);
    const [eventName, data, options] = queueAddSpy.mock.calls[0];

    expect(eventName).toBe(EVENT_TYPES.PLAYBACK_STARTED);
    expect(data.eventId).toBe("custom-event-uuid-1");
    expect(options.jobId).toBe("custom-event-uuid-1");
  });

  test("auto-generates eventId when none is provided", async () => {
    const queueAddSpy = jest.spyOn(analyticsQueue, "add").mockResolvedValue({ id: "job-2" });

    const result = await eventDispatcher.publish({
      eventName: EVENT_TYPES.SONG_VIEWED,
      anonymousId: "anon_test_user",
    });

    expect(result.success).toBe(true);
    expect(result.eventId).toBeDefined();
    expect(typeof result.eventId).toBe("string");
    expect(queueAddSpy).toHaveBeenCalledWith(
      EVENT_TYPES.SONG_VIEWED,
      expect.objectContaining({ eventId: result.eventId }),
      expect.objectContaining({ jobId: result.eventId })
    );
  });

  test("handles queue connection errors gracefully and non-blockingly", async () => {
    jest.spyOn(analyticsQueue, "add").mockRejectedValue(new Error("Redis connection refused"));

    const result = await eventDispatcher.publish({
      eventName: EVENT_TYPES.PLAYBACK_STARTED,
      userId: validMongoId,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Redis connection refused");
  });

  test("publishBatch dispatches multiple events concurrently", async () => {
    const queueAddSpy = jest.spyOn(analyticsQueue, "add").mockResolvedValue({ id: "job-batch" });

    const events = [
      { eventName: EVENT_TYPES.LANDING_PAGE_VIEWED, anonymousId: "anon_1" },
      { eventName: EVENT_TYPES.HOME_PAGE_VIEWED, anonymousId: "anon_1" },
    ];

    const results = await eventDispatcher.publishBatch(events);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(queueAddSpy).toHaveBeenCalledTimes(2);
  });
});
