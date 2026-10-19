// modules/analytics/application/event-router.js
import { EVENT_TYPES } from "../domain/event.types.js";
import { analyticsRepository, getDayString } from "../infrastructure/analytics.repository.js";
import { recentlyPlayedService } from "../../playback/recentlyPlayed.service.js";

/**
 * Event Router
 * Routes raw events to derived analytical tasks (Recently Played, Daily Aggregates).
 */
export const eventRouter = {
  async route(event) {
    const { eventName, userId, anonymousId, songId, artistId, occurredAt, properties = {} } = event;
    const dateStr = getDayString(occurredAt);
    const listenerId = userId ? String(userId) : anonymousId ? String(anonymousId) : null;

    switch (eventName) {
      // 1. Playback Started
      case EVENT_TYPES.PLAYBACK_STARTED: {
        // Update Recently Played if user is authenticated
        if (userId && songId) {
          try {
            await recentlyPlayedService.updateRecentlyPlayed({ userId, songId });
          } catch (err) {
            console.warn(`[EventRouter] RecentlyPlayed update failed for user ${userId}:`, err.message);
          }
        }

        // Daily play stats
        await Promise.all([
          analyticsRepository.updateSongDailyStats({
            songId,
            artistId,
            dateStr,
            listenerId,
            increments: { plays: 1 },
          }),
          artistId
            ? analyticsRepository.updateArtistDailyStats({
                artistId,
                dateStr,
                listenerId,
                increments: { plays: 1 },
              })
            : Promise.resolve(),
        ]);
        break;
      }

      // 2. Playback 30s (Qualified play)
      case EVENT_TYPES.PLAYBACK_30S: {
        await Promise.all([
          analyticsRepository.updateSongDailyStats({
            songId,
            artistId,
            dateStr,
            increments: { qualifiedPlays: 1 },
          }),
          artistId
            ? analyticsRepository.updateArtistDailyStats({
                artistId,
                dateStr,
                increments: { qualifiedPlays: 1 },
              })
            : Promise.resolve(),
        ]);
        break;
      }

      // 3. Playback Completed
      case EVENT_TYPES.PLAYBACK_COMPLETED: {
        await analyticsRepository.updateSongDailyStats({
          songId,
          artistId,
          dateStr,
          increments: { completions: 1 },
        });
        break;
      }

      // 4. Playback Skipped
      case EVENT_TYPES.PLAYBACK_SKIPPED: {
        await analyticsRepository.updateSongDailyStats({
          songId,
          artistId,
          dateStr,
          increments: { skips: 1 },
        });
        break;
      }

      // 5. Likes & Unlikes
      case EVENT_TYPES.SONG_LIKED: {
        await Promise.all([
          analyticsRepository.updateSongDailyStats({ songId, artistId, dateStr, increments: { likes: 1 } }),
          artistId ? analyticsRepository.updateArtistDailyStats({ artistId, dateStr, increments: { likes: 1 } }) : Promise.resolve(),
        ]);
        break;
      }
      case EVENT_TYPES.SONG_UNLIKED: {
        await Promise.all([
          analyticsRepository.updateSongDailyStats({ songId, artistId, dateStr, increments: { likes: -1 } }),
          artistId ? analyticsRepository.updateArtistDailyStats({ artistId, dateStr, increments: { likes: -1 } }) : Promise.resolve(),
        ]);
        break;
      }

      // 6. Follows & Unfollows
      case EVENT_TYPES.ARTIST_FOLLOWED: {
        if (artistId) {
          await analyticsRepository.updateArtistDailyStats({ artistId, dateStr, increments: { followers: 1 } });
        }
        break;
      }
      case EVENT_TYPES.ARTIST_UNFOLLOWED: {
        if (artistId) {
          await analyticsRepository.updateArtistDailyStats({ artistId, dateStr, increments: { followers: -1 } });
        }
        break;
      }

      // 7. Monetization
      case EVENT_TYPES.SUBSCRIPTION_STARTED: {
        if (artistId) {
          await analyticsRepository.updateArtistDailyStats({
            artistId,
            dateStr,
            increments: { subscriptionsStarted: 1 },
          });
        }
        break;
      }
      case EVENT_TYPES.SUBSCRIPTION_RENEWED: {
        if (artistId) {
          await analyticsRepository.updateArtistDailyStats({
            artistId,
            dateStr,
            increments: { subscriptionsRenewed: 1 },
          });
        }
        break;
      }
      case EVENT_TYPES.PURCHASE_COMPLETED: {
        if (artistId) {
          const revenueCents = Number(properties.amountCents) || (Number(properties.amount) ? Math.round(Number(properties.amount) * 100) : 0);
          await analyticsRepository.updateArtistDailyStats({
            artistId,
            dateStr,
            increments: {
              purchasesCompleted: 1,
              revenueCents,
            },
          });
        }
        break;
      }

      default:
        // Raw events are stored; no derived rollups needed for this event type
        break;
    }
  },
};
