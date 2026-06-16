import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const STRIPE_MIGRATION_QUEUE_NAME = "stripe-migration-queue";

export const stripeMigrationQueue = new Queue(STRIPE_MIGRATION_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

export const addStripeMigrationJob = async (artistId, newStripePlans) => {
  await stripeMigrationQueue.add("migrate-stripe-prices", {
    artistId,
    newStripePlans,
  });
};
