import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    itemType: {
      type: String,
      enum: ["song", "album", "artist-subscription"],
      required: true,
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
    },

    gateway: {
      type: String,
      enum: ["stripe", "razorpay", "paypal"],
      required: true,
    },

    amount: { type: Number, required: true },
    amountUSD: { type: Number },

    exchangeRate: {
      type: Number,
      min: 0,
    },

    exchangeRateSource: {
      type: String,
      enum: ["static", "provider", "manual"],
      default: "static",
    },

    exchangeRateAt: {
      type: Date,
    },

    currency: { type: String, required: true },

    platformFee: { type: Number, required: true },
    artistShare: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    paymentIntentId: String,      // Stripe
    razorpayOrderId: String,      // Razorpay
    stripeSubscriptionId: String, // Stripe recurring
    paypalOrderId: String,

    invoiceNumber: String,

    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

/* ======================================================
   INDEXES (PRODUCTION CRITICAL)
   ====================================================== */

// 🔹 User purchase history & dashboards
transactionSchema.index({ userId: 1, createdAt: -1 });

// 🔹 Artist revenue & admin analytics
transactionSchema.index({ artistId: 1, status: 1, createdAt: -1 });

// 🔹 Item-level lookups (song / album / subscription)
transactionSchema.index({ itemType: 1, itemId: 1 });

// 🔹 Webhook idempotency & fast gateway lookups
transactionSchema.index({ paymentIntentId: 1 }, { sparse: true });
transactionSchema.index({ razorpayOrderId: 1 }, { sparse: true });
transactionSchema.index({ paypalOrderId: 1 }, { sparse: true });
transactionSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });

// 🔹 Status-based scans (pending → paid → failed)
transactionSchema.index({ status: 1, createdAt: -1 });

// 🔹 Invoice / accounting audits
transactionSchema.index({ invoiceNumber: 1 }, { sparse: true });

export const Transaction = mongoose.model(
  "Transaction",
  transactionSchema
);
