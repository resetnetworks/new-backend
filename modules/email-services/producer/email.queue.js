import { Queue } from "bullmq";
import { redisConnection } from "./email.connection.js";

export const EMAIL_QUEUE_NAME = "email-queue";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
});