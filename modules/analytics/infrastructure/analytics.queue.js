// modules/analytics/infrastructure/analytics.queue.js
import { Queue } from "bullmq";
import { redisConnection } from "../../../queue/connection.js";
import { ANALYTICS_QUEUE_NAME } from "../domain/analytics.constants.js";

export const analyticsQueue = new Queue(ANALYTICS_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // 24 hours retention
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600, // 7 days retention for failed debug
    },
  },
});
