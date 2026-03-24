// modules/coupon/coupon.model.js
import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    /* -------------------- Discount -------------------- */
    type: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },

    value: {
      type: Number,
      required: true,
    },

    maxDiscount: Number,

    /* -------------------- Applicability -------------------- */
    applicableTo: {
      type: String,
      enum: ["subscription", "song", "album", "all"],
      default: "all",
      index: true,
    },

    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      default: null, // null = platform-wide
      index: true,
    },

    /* -------------------- Constraints -------------------- */
    minOrderAmount: Number,

    usageLimit: Number,     // global limit
    perUserLimit: Number,   // per user

    usedCount: {
      type: Number,
      default: 0,
    },

    /* -------------------- Time -------------------- */
    validFrom: Date,
    validUntil: Date,

    /* -------------------- Flags -------------------- */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    firstTimeOnly: {
      type: Boolean,
      default: false,
    },

    createdBy: {
    type: String,
    enum: ["admin", "artist"],
    required: true,
    },

    createdById: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "createdBy",
    }
  },
  { timestamps: true }
);

export const Coupon = mongoose.model("Coupon", couponSchema);