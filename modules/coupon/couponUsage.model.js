// modules/coupon/couponUsage.model.js
import mongoose from "mongoose";

const couponUsageSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
  },
  { timestamps: true }
);

/* Prevent duplicate usage race condition */
couponUsageSchema.index({ couponId: 1, userId: 1, transactionId: 1 });

export const CouponUsage = mongoose.model(
  "CouponUsage",
  couponUsageSchema
);