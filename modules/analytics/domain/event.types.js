// modules/analytics/domain/event.types.js
import { ALL_ANALYTICS_EVENTS } from "./analytics.constants.js";

export const EVENT_CATEGORIES = {
  ACQUISITION: "acquisition",
  AUTHENTICATION: "authentication",
  DISCOVERY: "discovery",
  PLAYBACK: "playback",
  ENGAGEMENT: "engagement",
  MONETIZATION: "monetization",
};

export const EVENT_TYPES = {
  // Acquisition
  LANDING_PAGE_VIEWED: "landing_page_viewed",
  HOME_PAGE_VIEWED: "home_page_viewed",

  // Authentication
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  LOGIN_COMPLETED: "login_completed",

  // Discovery
  ARTIST_VIEWED: "artist_viewed",
  ALBUM_VIEWED: "album_viewed",
  SONG_VIEWED: "song_viewed",
  SEARCH_PERFORMED: "search_performed",
  SEARCH_RESULT_CLICKED: "search_result_clicked",

  // Playback
  PLAYBACK_STARTED: "playback_started",
  PLAYBACK_30S: "playback_30s",
  PLAYBACK_50_PERCENT: "playback_50_percent",
  PLAYBACK_COMPLETED: "playback_completed",
  PLAYBACK_SKIPPED: "playback_skipped",
  PREVIEW_STARTED: "preview_started",

  // Engagement
  SONG_LIKED: "song_liked",
  SONG_UNLIKED: "song_unliked",
  ARTIST_FOLLOWED: "artist_followed",
  ARTIST_UNFOLLOWED: "artist_unfollowed",
  PLAYLIST_CREATED: "playlist_created",
  SONG_ADDED_TO_PLAYLIST: "song_added_to_playlist",

  // Monetization & Subscription Funnel
  SUBSCRIPTION_CLICKED: "subscription_clicked",
  CHECKOUT_STARTED: "checkout_started",
  PAYMENT_INITIATED: "payment_initiated",
  PAYMENT_COMPLETED: "payment_completed",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_ABANDONED: "payment_abandoned",
  SUBSCRIPTION_ACTIVATED: "subscription_activated",
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  SUBSCRIPTION_RENEWED: "subscription_renewed",
  PURCHASE_STARTED: "purchase_started",
  PURCHASE_COMPLETED: "purchase_completed",
  PURCHASE_FAILED: "purchase_failed",
  COUPON_APPLIED: "coupon_applied",
};

export const ALLOWED_EVENT_NAMES = Array.from(
  new Set([...Object.values(EVENT_TYPES), ...ALL_ANALYTICS_EVENTS])
);

export const isValidEventName = (name) => ALLOWED_EVENT_NAMES.includes(name);
export const isValidEventType = (eventType) => isValidEventName(eventType);

/**
 * Factory to build standard event payload with consistent shape
 */
export const createEventPayload = ({
  eventId,
  funnelId = null,
  eventType,
  eventName,
  userId = null,
  artistId = null,
  songId = null,
  albumId = null,
  planId = null,
  metadata = {},
  properties = {},
  context = {},
  timestamp = new Date(),
}) => {
  const resolvedEventName = eventType || eventName;
  const mergedProps = { ...metadata, ...properties };
  const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);

  return {
    eventId,
    funnelId,
    eventName: resolvedEventName,
    eventType: resolvedEventName,
    userId,
    artistId,
    songId,
    albumId,
    planId,
    metadata: mergedProps,
    properties: mergedProps,
    context,
    timestamp: dateObj,
    occurredAt: dateObj,
  };
};
