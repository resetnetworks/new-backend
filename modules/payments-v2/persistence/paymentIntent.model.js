import mongoose from "mongoose";
import { PaymentStatus } from "../domain/paymentStateMachine.js";

const paymentIntentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["song", "album", "subscription"],
      required: true,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["stripe", "razorpay", "paypal"],
      required: true,
      index: true,
    },

    providerRefId: {
      type: String,
      index: true,
      sparse: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      required: true,
    },

    platformFee: {
      type: Number,
      required: true,
    },

    artistAmount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.CREATED,
      index: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ---------------------------------------
   Indexes
--------------------------------------- */

// Fast lookup by provider reference
paymentIntentSchema.index(
  { provider: 1, providerRefId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerRefId: { $type: "string" } },
  }
);


// Expiry job support
paymentIntentSchema.index({ expiresAt: 1 });

// Status queries
paymentIntentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("PaymentIntentV2", paymentIntentSchema);
