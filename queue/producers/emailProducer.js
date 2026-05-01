import { emailQueue } from "../queues.js";

export const enqueueEmailJob = async (data) => {
  return emailQueue.add("send_email", data, {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  });
};