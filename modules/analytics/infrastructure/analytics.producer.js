// modules/analytics/infrastructure/analytics.producer.js
import { analyticsQueue } from "./analytics.queue.js";
import { eventDispatcher } from "../application/eventDispatcher.js";
import {
  ANALYTICS_EVENT_JOB,
  ABANDONMENT_CHECK_JOB,
  DEFAULT_ABANDON_TIMEOUT_MS,
} from "../domain/analytics.constants.js";

export { analyticsQueue, eventDispatcher };

export const analyticsProducer = {
  /**
   * Publish an event into BullMQ analytics queue
   * Uses eventId as jobId for deduplication in BullMQ.
   */
  async publishEvent(eventData) {
    if (!eventData || !eventData.eventId) {
      return eventDispatcher.publish(eventData);
    }

    const jobName = eventData.eventName || eventData.eventType || ANALYTICS_EVENT_JOB;
    return analyticsQueue.add(jobName, eventData, {
      jobId: eventData.eventId,
    });
  },

  /**
   * Schedule delayed check for abandoned payment attempt
   */
  async scheduleAbandonmentCheck(attemptId, delayMs = DEFAULT_ABANDON_TIMEOUT_MS) {
    if (!attemptId) {
      throw new Error("attemptId is required to schedule abandonment check");
    }

    return analyticsQueue.add(
      ABANDONMENT_CHECK_JOB,
      { attemptId: String(attemptId) },
      {
        delay: delayMs,
        jobId: `abandon:${String(attemptId)}`,
      }
    );
  },
};

export default analyticsProducer;
