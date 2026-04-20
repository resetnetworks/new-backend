import { logFullQueue, clearEmailQueue } from "./email.queue.utils.js";
import { emailQueue } from "../producer/email.queue.js";

// GET /api/queue/get-queue
export const getQueueJobs = async (req, res) => {
  const jobs = await emailQueue.getJobs([
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  ]);

  const formatted = await Promise.all(
    jobs.map(async (job) => ({
      id: job.id,
      name: job.name,
      state: job.finishedOn ? "completed" : "pending",
      status: await job.getState(),   // ⭐ now awaited correctly
      attemptsMade: job.attemptsMade,
      data: job.data,
    })))

  res.json({
    total: formatted.length,
    jobs: formatted,
  });
};


// DELETE /api/queue/delete-queue
export const clearQueue = async (req, res) => {
  await clearEmailQueue();
  res.json({ message: "Queue cleared" });
};