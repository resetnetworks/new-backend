import mongoose from "mongoose";
import { WebhookStatus } from "../domain/webhookEvent.js";

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["stripe", "razorpay", "paypal"],
      required: true,
      index: true,
    },

    eventId: {
      type: String,
      required: true,
      index: true,
    },

    eventType: {
      type: String,
      index: true,
    },

    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    headers: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },

    status: {
      type: String,
      enum: Object.values(WebhookStatus),
      default: WebhookStatus.PENDING,
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    lastError: {
      type: String,
    },

    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

/* ---------------------------------------
   Critical Indexes
--------------------------------------- */

// Idempotency: provider + eventId must be unique
webhookEventSchema.index(
  { provider: 1, eventId: 1 },
  { unique: true }
);

// Processing queue scan
webhookEventSchema.index({ status: 1, receivedAt: 1 });

// Analytics & audit
webhookEventSchema.index({ provider: 1, receivedAt: -1 });

export default mongoose.model("WebhookEventV2", webhookEventSchema);
