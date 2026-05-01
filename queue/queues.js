import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

const defaultOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
};

export const emailQueue = new Queue("emailQueue", defaultOptions);
export const notificationQueue = new Queue("notificationQueue", defaultOptions);