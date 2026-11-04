// modules/analytics/application/event-router.js
import { EVENT_TYPES } from "../domain/event.types.js";
import { ANALYTICS_EVENTS } from "../domain/analytics.constants.js";
import { analyticsRepository, getDayString } from "../infrastructure/analytics.repository.js";
import { recentlyPlayedService } from "../../playback/recentlyPlayed.service.js";

/**
 * Event Router
 * Routes raw events to derived analytical tasks (Recently Played, Daily Aggregates, Funnel tracking).
 */
export const eventRouter = {
  async route(event) {
    const eventName = event.eventName || event.eventType;
    const { userId, anonymousId, songId, artistId, funnelId, occurredAt, timestamp, properties = {}, metadata = {} } = event;
    const mergedProps = { ...properties, ...metadata };
    const dateStr = getDayString(occurredAt || timestamp);
    const listenerId = userId ? String(userId) : anonymousId ? String(anonymousId) : null;

    // Route to derived daily rollups and side-effects
    switch (eventName) {
      // --- Playback Started ---
      case EVENT_TYPES.PLAYBACK_STARTED: {
        if (userId && songId) {
          try {
            await recentlyPlayedService.updateRecentlyPlayed({ userId, songId });
          } catch (err) {
            console.warn(`[EventRouter] RecentlyPlayed update failed for user ${userId}:`, err.message);
          }
        }

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

      // --- Playback 30s (Qualified play) ---
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
                listenerId,
                increments: { qualifiedPlays: 1 },
              })
            : Promise.resolve(),
        ]);
        break;
      }

      // --- Playback Completed ---
      case EVENT_TYPES.PLAYBACK_COMPLETED: {
        await analyticsRepository.updateSongDailyStats({
          songId,
          artistId,
          dateStr,
          increments: { completions: 1 },
        });
        break;
      }

      // --- Playback Skipped ---
      case EVENT_TYPES.PLAYBACK_SKIPPED: {
        await analyticsRepository.updateSongDailyStats({
          songId,
          artistId,
          dateStr,
          increments: { skips: 1 },
        });
        break;
      }

      // --- Likes & Follows ---
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

      // --- Subscription & Monetization Funnel Events ---
      case ANALYTICS_EVENTS.SUBSCRIPTION_CLICKED:
        console.log(`[Analytics] Funnel ${funnelId || "N/A"}: Subscribe clicked for artist ${artistId}`);
        break;

      case ANALYTICS_EVENTS.CHECKOUT_STARTED:
        console.log(`[Analytics] Funnel ${funnelId || "N/A"}: Checkout session started (${mergedProps.checkoutSessionId || ""})`);
        break;

      case ANALYTICS_EVENTS.PAYMENT_INITIATED:
        console.log(`[Analytics] Funnel ${funnelId || "N/A"}: Payment initiated for artist ${artistId}`);
        break;

      case ANALYTICS_EVENTS.PAYMENT_COMPLETED: {
        console.log(`[Analytics] Funnel ${funnelId || "N/A"}: Payment completed`);
        if (artistId) {
          const revenueCents = Number(mergedProps.amountCents) || (Number(mergedProps.amount) ? Math.round(Number(mergedProps.amount) * 100) : 0);
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

      case ANALYTICS_EVENTS.PAYMENT_FAILED:
        console.warn(`[Analytics] Funnel ${funnelId || "N/A"}: Payment failed (${mergedProps.reason || "unknown"})`);
        break;

      case ANALYTICS_EVENTS.PAYMENT_ABANDONED:
        console.warn(`[Analytics] Funnel ${funnelId || "N/A"}: Payment abandoned`);
        break;

      case ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATED:
      case EVENT_TYPES.SUBSCRIPTION_STARTED: {
        console.log(`[Analytics] Funnel ${funnelId || "N/A"}: Subscription activated for user ${userId}`);
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
          const revenueCents = Number(mergedProps.amountCents) || (Number(mergedProps.amount) ? Math.round(Number(mergedProps.amount) * 100) : 0);
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
        break;
    }

    return true;
  },
};

export default eventRouter;
