import { Queue } from "bullmq";
import { redisConnection } from "../../../queue/connection.js";

const defaultOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 10000,
    },
  },
};

export const migrationQueue = new Queue("migrationQueue", defaultOptions);

export default migrationQueue;
