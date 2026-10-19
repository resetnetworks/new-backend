// tests/analytics/eventSchema.test.js
import { validateAnalyticsEvent } from "../../modules/analytics/domain/event.schema.js";
import { EVENT_TYPES } from "../../modules/analytics/domain/event.types.js";

describe("Analytics Event Validation Schema", () => {
  const validMongoId = "507f1f77bcf86cd799439011";

  test("accepts a valid authenticated playback event", () => {
    const payload = {
      eventId: "test-event-1",
      eventName: EVENT_TYPES.PLAYBACK_STARTED,
      userId: validMongoId,
      songId: validMongoId,
      properties: {
        bitrate: "320kbps",
        source: "playlist",
      },
    };

    const { valid, errors, sanitized } = validateAnalyticsEvent(payload);

    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(sanitized.eventId).toBe("test-event-1");
    expect(sanitized.eventName).toBe(EVENT_TYPES.PLAYBACK_STARTED);
    expect(sanitized.userId).toBe(validMongoId);
    expect(sanitized.songId).toBe(validMongoId);
    expect(sanitized.context.platform).toBe("web");
    expect(sanitized.context.deviceType).toBe("unknown");
    expect(sanitized.properties.bitrate).toBe("320kbps");
  });

  test("accepts an anonymous event with anonymousId", () => {
    const payload = {
      eventId: "test-event-2",
      eventName: EVENT_TYPES.LANDING_PAGE_VIEWED,
      anonymousId: "anon_12345",
      context: {
        platform: "ios",
        deviceType: "mobile",
        country: "US",
      },
    };

    const { valid, errors, sanitized } = validateAnalyticsEvent(payload);

    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(sanitized.anonymousId).toBe("anon_12345");
    expect(sanitized.userId).toBeNull();
    expect(sanitized.context.platform).toBe("ios");
    expect(sanitized.context.deviceType).toBe("mobile");
    expect(sanitized.context.country).toBe("US");
  });

  test("falls back to sessionId for anonymous identity if both userId and anonymousId are missing", () => {
    const payload = {
      eventId: "test-event-3",
      eventName: EVENT_TYPES.PLAYBACK_STARTED,
      sessionId: "session_abc",
      songId: validMongoId,
    };

    const { valid, errors, sanitized } = validateAnalyticsEvent(payload);

    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(sanitized.anonymousId).toBe("sess_session_abc");
  });

  test("rejects event when neither userId, anonymousId, nor sessionId are provided", () => {
    const payload = {
      eventId: "test-event-4",
      eventName: EVENT_TYPES.SONG_VIEWED,
    };

    const { valid, errors } = validateAnalyticsEvent(payload);

    expect(valid).toBe(false);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("userId, anonymousId, or sessionId"),
      ])
    );
  });

  test("rejects unregistered event names", () => {
    const payload = {
      eventId: "test-event-5",
      eventName: "unregistered_bogus_event",
      anonymousId: "anon_test",
    };

    const { valid, errors } = validateAnalyticsEvent(payload);

    expect(valid).toBe(false);
    expect(errors[0]).toContain("Invalid eventName");
  });

  test("rejects malformed ObjectIds", () => {
    const payload = {
      eventId: "test-event-6",
      eventName: EVENT_TYPES.SONG_LIKED,
      anonymousId: "anon_test",
      songId: "not-a-valid-mongo-id",
    };

    const { valid, errors } = validateAnalyticsEvent(payload);

    expect(valid).toBe(false);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("songId must be a valid ObjectId string"),
      ])
    );
  });
});
