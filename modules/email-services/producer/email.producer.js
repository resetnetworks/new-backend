import { emailQueue } from "./email.queue.js";

export const EmailProducer = {

  async addJob(jobName, payload) {

    console.log("--------------------")
    console.log("📩 Adding email job:", jobName, payload);
    console.log("--------------------")

    await emailQueue.add(jobName, payload, {
      attempts: 5, // retry 5 times
      backoff: {
        type: "exponential",
        delay: 30000, // 30 sec → 1m → 2m → 4m → 8m
      },
      removeOnComplete: true,
      removeOnFail: false, // keep failed jobs for debugging
    });
  },
};
