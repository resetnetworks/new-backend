// modules/analytics/application/eventDispatcher.js
import { v4 as uuidv4 } from "uuid";
import { analyticsQueue } from "../infrastructure/analytics.queue.js";
import { validateAnalyticsEvent } from "../domain/event.schema.js";

/**
 * Event Dispatcher
 * Application code calls this service without knowing BullMQ details.
 */
export const eventDispatcher = {
  /**
   * Publishes a single analytics event to the asynchronous processing queue.
   * @param {Object} rawPayload
   * @returns {Promise<{ success: boolean, eventId?: string, error?: string }>}
   */
  async publish(rawPayload) {
    try {
      const payload = {
        eventId: rawPayload.eventId || uuidv4(),
        occurredAt: rawPayload.occurredAt || new Date(),
        ...rawPayload,
      };

      const { valid, errors, sanitized } = validateAnalyticsEvent(payload);
      if (!valid) {
        console.warn(`[EventDispatcher] Invalid event skipped (${payload.eventName}):`, errors);
        return { success: false, error: errors.join(", ") };
      }

      // Enqueue job with jobId = eventId for queue-level deduplication
      await analyticsQueue.add(sanitized.eventName, sanitized, {
        jobId: sanitized.eventId,
      });

      return { success: true, eventId: sanitized.eventId };
    } catch (error) {
      console.error(`[EventDispatcher] Failed to dispatch event:`, error.message);
      // Non-blocking: analytics dispatch should never throw uncaught exceptions to business operations
      return { success: false, error: error.message };
    }
  },

  /**
   * Publishes multiple events in a single batch.
   * @param {Array<Object>} events
   * @returns {Promise<Array<{ success: boolean, eventId?: string, error?: string }>>}
   */
  async publishBatch(events = []) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }
    return Promise.all(events.map((ev) => this.publish(ev)));
  },
};
