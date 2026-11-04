// modules/analytics/domain/models/CheckoutAttempt.js
import mongoose from "mongoose";
import { ALL_CHECKOUT_ATTEMPT_STATUSES, CHECKOUT_ATTEMPT_STATUS } from "../analytics.constants.js";

const checkoutAttemptSchema = new mongoose.Schema(
  {
    funnelId: {
      type: String,
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },

    planId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    cycle: {
      type: String,
      enum: ["1m", "3m", "6m", "12m"],
    },

    gateway: {
      type: String,
      enum: ["stripe", "razorpay", "paypal"],
      required: true,
    },

    gatewaySessionId: {
      type: String,
      index: true,
      sparse: true,
    },

    gatewayPaymentIntentId: {
      type: String,
      index: true,
      sparse: true,
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      index: true,
      sparse: true,
    },

    status: {
      type: String,
      enum: ALL_CHECKOUT_ATTEMPT_STATUSES,
      default: CHECKOUT_ATTEMPT_STATUS.PENDING,
      index: true,
    },

    amount: {
      type: Number,
    },

    currency: {
      type: String,
      default: "USD",
    },

    expiresAt: {
      type: Date,
      index: true,
    },

    completedAt: {
      type: Date,
    },

    failedAt: {
      type: Date,
    },

    abandonedAt: {
      type: Date,
    },

    failureReason: {
      type: String,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

checkoutAttemptSchema.index({
  status: 1,
  expiresAt: 1,
});

checkoutAttemptSchema.index({
  artistId: 1,
  createdAt: -1,
});

export const CheckoutAttempt =
  mongoose.models.CheckoutAttempt ||
  mongoose.model("CheckoutAttempt", checkoutAttemptSchema);

export default CheckoutAttempt;
