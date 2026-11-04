// modules/analytics/index.js
export { eventDispatcher } from "./application/eventDispatcher.js";
export { analyticsService } from "./application/analytics.service.js";
export { analyticsProducer } from "./infrastructure/analytics.producer.js";
export { analyticsQueue } from "./infrastructure/analytics.queue.js";
export { analyticsWorker } from "./infrastructure/analytics.worker.js";
export { analyticsRepository } from "./infrastructure/analytics.repository.js";

export { AnalyticsEvent } from "./domain/models/AnalyticsEvent.js";
export { CheckoutAttempt } from "./domain/models/CheckoutAttempt.js";
export { SongDailyStats } from "./domain/models/SongDailyStats.js";
export { ArtistDailyStats } from "./domain/models/ArtistDailyStats.js";

export { EVENT_TYPES, EVENT_CATEGORIES } from "./domain/event.types.js";
export { ANALYTICS_EVENTS, CHECKOUT_ATTEMPT_STATUS, FUNNEL_STAGES } from "./domain/analytics.constants.js";
export { default as analyticsRoutes } from "./interfaces/analytics.routes.js";
