import { EmailJob, EMAIL_STATUS } from "../models/emailJob.model.js";
import { EmailEvent, EMAIL_EVENT_TYPES } from "../models/emailEvent.model.js";


//==============================================================
// 📨 CREATE EMAIL JOB (API ENTRYPOINT)
// Creates a new email job in DB and logs initial JOB_CREATED event
//==============================================================
export const createEmailJob = async ({ userId, toEmail, template, subject, metadata, }) => {
  const job = await EmailJob.create({
    userId,
    toEmail,
    template,
    subject,
    metadata,
  });

  await EmailEvent.create({
    jobId: job._id,
    type: EMAIL_EVENT_TYPES.JOB_CREATED,
    source: "api",
    message: "Email job created",
  });

  return job;
};

//==============================================================
// 📦 MARK JOB AS QUEUED (SQS PRODUCER)
// Updates job status to QUEUED and records queue event
//==============================================================
export const markQueuedToSQS = async (jobId, sqsMessageId) => {
  await EmailJob.findByIdAndUpdate(jobId, {
    status: EMAIL_STATUS.QUEUED,
    sqsMessageId,
  });

  await EmailEvent.create({
    jobId,
    type: EMAIL_EVENT_TYPES.QUEUED,
    source: "producer",
    sqsMessageId,
  });
};


//==============================================================
// ⚙️ WORKER STARTED PROCESSING
// Marks job as PROCESSING when worker receives SQS message
//==============================================================
export const markWorkerProcessing = async (jobId, sqsMessageId) => {
  await EmailJob.findByIdAndUpdate(jobId, {
    status: EMAIL_STATUS.PROCESSING,
    sqsMessageId,
  });

  await EmailEvent.create({
    jobId,
    type: EMAIL_EVENT_TYPES.WORKER_RECEIVED,
    source: "worker",
    sqsMessageId,
  });
};

//==============================================================
// 🔁 RETRY EMAIL JOB
// Increments attempt count and logs retry event on failure
//==============================================================
export const markRetry = async (jobId, error) => {
  const job = await EmailJob.findByIdAndUpdate(
    jobId,
    {
      $inc: { attempts: 1 },
      status: EMAIL_STATUS.RETRYING,
      lastError: error,
    },
    { new: true }
  );

  await EmailEvent.create({
    jobId,
    type: EMAIL_EVENT_TYPES.RETRYING,
    source: "worker",
    error,
    attempts: job.attempts,
  });
};

//==============================================================
// ✅ EMAIL SENT SUCCESSFULLY (SES)
// Updates job as SENT and stores SES message metadata
//==============================================================
export const markEmailSent = async (jobId, sesMessageId) => {
  await EmailJob.findByIdAndUpdate(jobId, {
    status: EMAIL_STATUS.SENT,
    sesMessageId,
    sentAt: new Date(),
  });

  await EmailEvent.create({
    jobId,
    type: EMAIL_EVENT_TYPES.SES_SEND_SUCCESS,
    source: "ses",
    sesMessageId,
  });
};


//==============================================================
// ❌ FINAL FAILURE → MOVED TO DEAD LETTER QUEUE (DLQ)
// Marks job as permanently failed and logs error details
//==============================================================
export const markMovedToDLQ = async (jobId, error) => {
  await EmailJob.findByIdAndUpdate(jobId, {
    status: EMAIL_STATUS.MOVED_TO_DLQ,
    lastError: error,
  });

  await EmailEvent.create({
    jobId,
    type: EMAIL_EVENT_TYPES.MOVED_TO_DLQ,
    source: "dlq",
    error,
  });
};



export default {
  createEmailJob,
  markQueuedToSQS,
  markWorkerProcessing,
  markRetry,
  markEmailSent,
  markMovedToDLQ,
};