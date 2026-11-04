// tests/analytics/eventRouter.test.js
import { jest } from "@jest/globals";
import { eventRouter } from "../../modules/analytics/application/event-router.js";
import { analyticsRepository } from "../../modules/analytics/infrastructure/analytics.repository.js";
import { recentlyPlayedService } from "../../modules/playback/recentlyPlayed.service.js";
import { EVENT_TYPES } from "../../modules/analytics/domain/event.types.js";

describe("Event Router (Derived Analytics)", () => {
  const songId = "507f1f77bcf86cd799439011";
  const artistId = "507f1f77bcf86cd799439022";
  const userId = "507f1f77bcf86cd799439033";

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("routes playback_started to updateRecentlyPlayed and increments Song & Artist plays", async () => {
    const updateRecentSpy = jest.spyOn(recentlyPlayedService, "updateRecentlyPlayed").mockResolvedValue();
    const updateSongStatsSpy = jest.spyOn(analyticsRepository, "updateSongDailyStats").mockResolvedValue({});
    const updateArtistStatsSpy = jest.spyOn(analyticsRepository, "updateArtistDailyStats").mockResolvedValue({});

    await eventRouter.route({
      eventName: EVENT_TYPES.PLAYBACK_STARTED,
      userId,
      songId,
      artistId,
      occurredAt: new Date("2026-10-05T12:00:00Z"),
    });

    expect(updateRecentSpy).toHaveBeenCalledWith({ userId, songId });
    expect(updateSongStatsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        songId,
        artistId,
        dateStr: "2026-10-05",
        increments: { plays: 1 },
      })
    );
    expect(updateArtistStatsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId,
        dateStr: "2026-10-05",
        increments: { plays: 1 },
      })
    );
  });

  test("routes playback_30s to increment qualifiedPlays", async () => {
    const updateSongStatsSpy = jest.spyOn(analyticsRepository, "updateSongDailyStats").mockResolvedValue({});
    const updateArtistStatsSpy = jest.spyOn(analyticsRepository, "updateArtistDailyStats").mockResolvedValue({});

    await eventRouter.route({
      eventName: EVENT_TYPES.PLAYBACK_30S,
      songId,
      artistId,
      occurredAt: new Date("2026-10-05T12:00:00Z"),
    });

    expect(updateSongStatsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        increments: { qualifiedPlays: 1 },
      })
    );
    expect(updateArtistStatsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        increments: { qualifiedPlays: 1 },
      })
    );
  });

  test("routes song_liked to increment net likes", async () => {
    const updateSongStatsSpy = jest.spyOn(analyticsRepository, "updateSongDailyStats").mockResolvedValue({});
    const updateArtistStatsSpy = jest.spyOn(analyticsRepository, "updateArtistDailyStats").mockResolvedValue({});

    await eventRouter.route({
      eventName: EVENT_TYPES.SONG_LIKED,
      songId,
      artistId,
      occurredAt: new Date("2026-10-05T12:00:00Z"),
    });

    expect(updateSongStatsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ increments: { likes: 1 } })
    );
    expect(updateArtistStatsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ increments: { likes: 1 } })
    );
  });

  test("routes purchase_completed to increment purchases and revenueCents", async () => {
    const updateArtistStatsSpy = jest.spyOn(analyticsRepository, "updateArtistDailyStats").mockResolvedValue({});

    await eventRouter.route({
      eventName: EVENT_TYPES.PURCHASE_COMPLETED,
      artistId,
      occurredAt: new Date("2026-10-05T12:00:00Z"),
      properties: {
        amountCents: 1500,
      },
    });

    expect(updateArtistStatsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        increments: { purchasesCompleted: 1, revenueCents: 1500 },
      })
    );
  });
});
