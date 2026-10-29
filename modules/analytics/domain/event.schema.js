// modules/analytics/domain/event.schema.js
import mongoose from "mongoose";
import { ALLOWED_DEVICE_TYPES, ALLOWED_PLATFORMS, DEFAULT_EVENT_VERSION } from "./analytics.constants.js";
import { isValidEventName } from "./event.types.js";
import { AnalyticsEvent } from "./models/AnalyticsEvent.js";
import { CheckoutAttempt } from "./models/CheckoutAttempt.js";

/**
 * Validates a single analytics event payload against system contracts.
 * Returns { valid: boolean, errors: string[], sanitized: Object }
 */
export const validateAnalyticsEvent = (event) => {
  const errors = [];

  if (!event || typeof event !== "object") {
    return { valid: false, errors: ["Event payload must be a non-null object"], sanitized: null };
  }

  // 1. eventId
  let eventId = event.eventId;
  if (!eventId || typeof eventId !== "string" || eventId.trim().length === 0) {
    eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  } else {
    eventId = String(eventId).trim();
  }

  // 2. eventName / eventType
  const resolvedEventName = event.eventName || event.eventType;
  if (!resolvedEventName || !isValidEventName(resolvedEventName)) {
    errors.push(`Invalid eventName/eventType: "${resolvedEventName}". Must be one of registered event types.`);
  }

  // 3. occurredAt / timestamp
  let occurredAt = event.occurredAt || event.timestamp ? new Date(event.occurredAt || event.timestamp) : new Date();
  if (isNaN(occurredAt.getTime())) {
    errors.push("occurredAt/timestamp must be a valid date or timestamp");
    occurredAt = new Date();
  }

  // 4. Identity - Must have at least userId or anonymousId or sessionId or funnelId
  let anonymousId = event.anonymousId ? String(event.anonymousId).trim() : null;
  const hasUser = event.userId && mongoose.Types.ObjectId.isValid(event.userId);

  if (!hasUser && !anonymousId && event.sessionId) {
    anonymousId = `sess_${String(event.sessionId).trim()}`;
  }
  if (!hasUser && !anonymousId && event.funnelId) {
    anonymousId = `fnl_${String(event.funnelId).trim()}`;
  }
  const hasAnon = Boolean(anonymousId && anonymousId.length > 0);

  if (!hasUser && !hasAnon) {
    errors.push("Event must include at least a valid userId, anonymousId, or sessionId");
  }

  // 5. Entity IDs (optional, but if present must be valid MongoDB ObjectIds)
  const validateObjectId = (val, fieldName) => {
    if (val && !mongoose.Types.ObjectId.isValid(val)) {
      errors.push(`${fieldName} must be a valid ObjectId string`);
      return null;
    }
    return val ? String(val) : null;
  };

  const userId = validateObjectId(event.userId, "userId");
  const songId = validateObjectId(event.songId, "songId");
  const albumId = validateObjectId(event.albumId, "albumId");
  const artistId = validateObjectId(event.artistId, "artistId");

  // 6. Context sanitization
  const rawContext = event.context || {};
  const context = {
    country: typeof rawContext.country === "string" ? rawContext.country.slice(0, 50).trim() : null,
    region: typeof rawContext.region === "string" ? rawContext.region.slice(0, 100).trim() : null,
    city: typeof rawContext.city === "string" ? rawContext.city.slice(0, 100).trim() : null,
    deviceType: ALLOWED_DEVICE_TYPES.includes(rawContext.deviceType) ? rawContext.deviceType : "unknown",
    operatingSystem: typeof rawContext.operatingSystem === "string" ? rawContext.operatingSystem.slice(0, 50).trim() : null,
    browser: typeof rawContext.browser === "string" ? rawContext.browser.slice(0, 50).trim() : null,
    platform: ALLOWED_PLATFORMS.includes(rawContext.platform) ? rawContext.platform : "web",
    ipHash: typeof rawContext.ipHash === "string" ? rawContext.ipHash : null,
  };

  // 7. Properties & Metadata sanitization
  let properties = {};
  const rawProps = event.properties || event.metadata || {};
  if (rawProps && typeof rawProps === "object" && !Array.isArray(rawProps)) {
    try {
      properties = JSON.parse(JSON.stringify(rawProps));
    } catch {
      properties = {};
    }
  }

  const sanitized = {
    eventId,
    funnelId: event.funnelId ? String(event.funnelId).trim() : null,
    eventName: resolvedEventName,
    eventType: resolvedEventName,
    eventVersion: Number(event.eventVersion) || DEFAULT_EVENT_VERSION,
    occurredAt,
    timestamp: occurredAt,
    anonymousId,
    userId,
    sessionId: event.sessionId ? String(event.sessionId).trim() : null,
    songId,
    albumId,
    artistId,
    planId: event.planId || null,
    context,
    properties,
    metadata: properties,
  };

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
};

export { AnalyticsEvent, CheckoutAttempt };
export default {
  AnalyticsEvent,
  CheckoutAttempt,
  validateAnalyticsEvent,
};
