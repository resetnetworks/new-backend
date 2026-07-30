import mongoose from "mongoose";

const couponRedemptionSchema = new mongoose.Schema(
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

    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      unique: true,
    },

    gateway: {
      type: String,
      enum: ["stripe", "razorpay", "paypal"],
      required: true,
    },

    itemType: {
      type: String,
      enum: ["song", "album", "subscription"],
      required: true,
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    originalAmount: {
      type: Number,
      required: true,
    },

    discountAmount: {
      type: Number,
      required: true,
    },

    finalAmount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "redeemed", "failed", "refunded"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/* Prevent duplicate successful redemption for same user */
couponRedemptionSchema.index({
  couponId: 1,
  userId: 1,
});

export const CouponRedemption = mongoose.model(
  "CouponRedemption",
  couponRedemptionSchema
);