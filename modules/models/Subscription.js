import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
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

    cycle: {
      type: String,
      enum: ["1m", "3m", "6m", "12m"],
      required: true,
    },

    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    validUntil: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },

    isRecurring: {
      type: Boolean,
      default: true,
    },

    gateway: {
      type: String,
      enum: ["stripe", "razorpay", "paypal"],
      required: true,
    },

    externalSubscriptionId: {
      type: String, // Stripe / Razorpay subscription ID
      required: true,
      index: true,
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },

    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ======================================================
   INDEXES (PRODUCTION CRITICAL)
   ====================================================== */

// 🔒 Enforce ONE subscription per user per artist
// (status is handled in logic, not index)
subscriptionSchema.index(
  { userId: 1, artistId: 1 },
  { unique: true }
);

// 🚀 Fast lookup: user's active subscriptions
subscriptionSchema.index(
  { userId: 1, status: 1, validUntil: -1 }
);

// 🚀 Artist dashboard: active subscribers + churn
subscriptionSchema.index(
  { artistId: 1, status: 1, validUntil: -1 }
);

// 🔁 Renewal / expiry jobs
subscriptionSchema.index(
  { status: 1, validUntil: 1 }
);

// 🔁 Webhook idempotency & gateway callbacks
subscriptionSchema.index(
  { externalSubscriptionId: 1 },
  { unique: true }
);

// 🧾 Transaction-based audits
subscriptionSchema.index(
  { transactionId: 1 },
  { sparse: true }
);

// 📊 Analytics / time-based queries
subscriptionSchema.index(
  { createdAt: -1 }
);

export const Subscription =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", subscriptionSchema);
