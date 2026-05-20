import mongoose from "mongoose";

export const EMAIL_STATUS = {
  QUEUED: "queued",
  PROCESSING: "processing",
  RETRYING: "retrying",
  SENT: "sent",
  FAILED: "failed",
  MOVED_TO_DLQ: "moved_to_dlq",
};

const emailJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    toEmail: {
      type: String,
      required: true,
      index: true,
    },

    template: {
      type: String,
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(EMAIL_STATUS),
      default: EMAIL_STATUS.QUEUED,
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    sqsMessageId: {
      type: String,
      default: null,
    },

    sesMessageId: {
      type: String,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed, // resetToken etc
      default: null,
    },

    sentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const EmailJob = mongoose.model("EmailJob", emailJobSchema);