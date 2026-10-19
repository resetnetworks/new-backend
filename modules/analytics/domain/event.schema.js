// modules/analytics/domain/event.schema.js
import mongoose from "mongoose";
import { ALLOWED_DEVICE_TYPES, ALLOWED_PLATFORMS, DEFAULT_EVENT_VERSION } from "./analytics.constants.js";
import { isValidEventName } from "./event.types.js";

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
  if (!event.eventId || typeof event.eventId !== "string" || event.eventId.trim().length === 0) {
    errors.push("eventId is required and must be a non-empty string");
  }

  // 2. eventName
  if (!event.eventName || !isValidEventName(event.eventName)) {
    errors.push(`Invalid eventName: "${event.eventName}". Must be one of registered event types.`);
  }

  // 3. occurredAt
  let occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
  if (isNaN(occurredAt.getTime())) {
    errors.push("occurredAt must be a valid date or timestamp");
    occurredAt = new Date();
  }

  // 4. Identity - Must have at least userId or anonymousId (or sessionId fallback)
  let anonymousId = event.anonymousId ? String(event.anonymousId).trim() : null;
  const hasUser = event.userId && mongoose.Types.ObjectId.isValid(event.userId);

  if (!hasUser && !anonymousId && event.sessionId) {
    anonymousId = `sess_${String(event.sessionId).trim()}`;
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

  // 7. Properties sanitization (prevent arbitrary deeply nested structures or prototype pollution)
  let properties = {};
  if (event.properties && typeof event.properties === "object" && !Array.isArray(event.properties)) {
    try {
      properties = JSON.parse(JSON.stringify(event.properties));
    } catch {
      properties = {};
    }
  }

  const sanitized = {
    eventId: event.eventId ? String(event.eventId).trim() : undefined,
    eventName: event.eventName,
    eventVersion: Number(event.eventVersion) || DEFAULT_EVENT_VERSION,
    occurredAt,
    anonymousId,
    userId,
    sessionId: event.sessionId ? String(event.sessionId).trim() : null,
    songId,
    albumId,
    artistId,
    context,
    properties,
  };

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
};
