import mongoose from "mongoose";

export const EMAIL_EVENT_TYPES = {
  JOB_CREATED: "job_created",
  QUEUED: "queued_to_sqs",
  WORKER_RECEIVED: "worker_received",
  RETRYING: "retrying",
  SES_SEND_SUCCESS: "ses_send_success",
  SES_SEND_FAILED: "ses_send_failed",
  MOVED_TO_DLQ: "moved_to_dlq",
};

const emailEventSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmailJob",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(EMAIL_EVENT_TYPES),
      required: true,
      index: true,
    },

    source: {
      type: String, // api | producer | worker | ses | dlq
      required: true,
    },

    message: {
      type: String,
      default: null,
    },

    error: {
      type: String,
      default: null,
    },

    attempts: {
      type: Number,
      default: null,
    },

    sqsMessageId: {
      type: String,
      default: null,
    },

    sesMessageId: {
      type: String,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const EmailEvent = mongoose.model("EmailEvent", emailEventSchema);