import mongoose from "mongoose";
import { LedgerType } from "../domain/paymentLedger.js";

const paymentLedgerSchema = new mongoose.Schema(
  {
    paymentIntentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentIntentV2",
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["stripe", "razorpay", "paypal"],
      required: true,
      index: true,
    },

    providerTransactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(LedgerType),
      required: true,
      index: true,
    },

    amountOriginal: {
      type: Number,
      required: true,
    },

    currencyOriginal: {
      type: String,
      required: true,
      index: true,
    },

    amountBase: {
      type: Number,
      required: true,
      index: true,
    },

    baseCurrency: {
      type: String,
      required: true,
    },

    exchangeRate: {
      type: Number,
      required: true,
    },

    exchangeRateAt: {
      type: Date,
      required: true,
    },

    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ---------------------------------------
   Indexes for performance & analytics
--------------------------------------- */

// Revenue analytics
paymentLedgerSchema.index({ createdAt: -1 });

// Provider-level reconciliation
paymentLedgerSchema.index({ provider: 1, createdAt: -1 });

// PaymentIntent linkage
paymentLedgerSchema.index({ paymentIntentId: 1, type: 1 });

export default mongoose.model("PaymentLedgerV2", paymentLedgerSchema);
