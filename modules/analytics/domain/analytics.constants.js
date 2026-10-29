// modules/analytics/domain/analytics.constants.js

export const ANALYTICS_QUEUE_NAME = "analytics-events";

export const DEFAULT_EVENT_VERSION = 1;

export const QUALIFIED_PLAY_SECONDS = 30;

export const ALLOWED_PLATFORMS = ["web", "ios", "android", "api", "unknown"];

export const ALLOWED_DEVICE_TYPES = ["mobile", "tablet", "desktop", "unknown"];

export const MAX_BATCH_EVENT_SIZE = 50;

export const MAX_PROPERTY_DEPTH = 3;

export const ABANDONMENT_CHECK_JOB = "check-abandoned-payment";
export const ANALYTICS_EVENT_JOB = "analytics-event";
export const DEFAULT_ABANDON_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const CHECKOUT_ATTEMPT_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  ABANDONED: "abandoned",
});

export const ALL_CHECKOUT_ATTEMPT_STATUSES = Object.values(CHECKOUT_ATTEMPT_STATUS);

export const ANALYTICS_EVENTS = Object.freeze({
  SUBSCRIPTION_CLICKED: "subscription_clicked",
  CHECKOUT_STARTED: "checkout_started",
  PAYMENT_INITIATED: "payment_initiated",
  PAYMENT_COMPLETED: "payment_completed",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_ABANDONED: "payment_abandoned",
  SUBSCRIPTION_ACTIVATED: "subscription_activated",

  // Player & Navigation
  LANDING_PAGE_VIEWED: "landing_page_viewed",
  HOME_PAGE_VIEWED: "home_page_viewed",
  ARTIST_VIEWED: "artist_viewed",
  ALBUM_VIEWED: "album_viewed",
  SONG_VIEWED: "song_viewed",
  SEARCH_PERFORMED: "search_performed",
  PLAYBACK_STARTED: "playback_started",
  PLAYBACK_30S: "playback_30s",
  PLAYBACK_COMPLETED: "playback_completed",

  // Artist Onboarding & Applications
  ARTIST_APPLICATION_SUBMITTED: "artist_application_submitted",
  ARTIST_APPLICATION_APPROVED: "artist_application_approved",
  ARTIST_APPLICATION_REJECTED: "artist_application_rejected",
  ARTIST_ONBOARDING_COMPLETED: "artist_onboarding_completed",
});

export const ALL_ANALYTICS_EVENTS = Object.values(ANALYTICS_EVENTS);

export const FUNNEL_STAGES = Object.freeze([
  ANALYTICS_EVENTS.SUBSCRIPTION_CLICKED,
  ANALYTICS_EVENTS.CHECKOUT_STARTED,
  ANALYTICS_EVENTS.PAYMENT_INITIATED,
  ANALYTICS_EVENTS.PAYMENT_COMPLETED,
  ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATED,
]);
