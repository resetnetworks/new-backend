
import { emailQueue } from "../producer/email.queue.js";

export async function logFullQueue() {
  const jobs = await emailQueue.getJobs([
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  ]);

  console.log("\n📬 ALL JOBS IN QUEUE\n");

  if (jobs.length === 0) {
    console.log("Queue is empty ✅");
    return;
  }

  jobs.forEach(job => {
    console.log({
      id: job.id,
      name: job.name,
      state: job.finishedOn ? "completed" : "pending",
      data: job.data,
      attemptsMade: job.attemptsMade,
    });
  });
}

export async function clearEmailQueue() {
  try {
    console.log("🧹 Clearing email queue...");

    await emailQueue.obliterate({ force: true });

    console.log("✅ Email queue cleared");
  } catch (err) {
    console.error("❌ Failed to clear queue:", err.message);
  }
}