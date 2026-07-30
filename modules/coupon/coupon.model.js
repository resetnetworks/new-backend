import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    /* -------------------- Coupon -------------------- */
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    /* -------------------- Owner -------------------- */
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },

    /* -------------------- Discount -------------------- */
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: function (value) {
          if (this.discountType === "percentage") {
            return value <= 100;
          }
          return true;
        },
        message: "Percentage discount cannot exceed 100%.",
      },
    },

    // Used only for percentage discounts
    maxDiscount: {
      type: Number,
      default: null,
    },

    /* -------------------- Applies To -------------------- */
    appliesTo: {
      type: [
        {
          type: String,
          enum: ["song", "album", "subscription"],
        },
      ],
      required: true,
      validate: [(v) => v.length > 0, "At least one target is required."],
    },

    /* -------------------- Eligibility -------------------- */
    eligibility: {
      type: String,
      enum: [
        "everyone",
        "first_purchase",
        "first_subscription",
      ],
      default: "everyone",
    },

    /* -------------------- Usage -------------------- */
    usageLimit: {
      type: Number,
      default: 0, // 0 = unlimited
      min: 0,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },

    minimumPurchase: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* -------------------- Validity -------------------- */
    startsAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: Date,

    /* -------------------- Status -------------------- */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    /* -------------------- Payment Provider Mapping -------------------- */
    providerIds: {
      stripe: {
        couponId: String,
      },

      razorpay: {
        offerId: String,
      },

      paypal: {
        couponId: String,
      },
    },

    /* -------------------- Audit -------------------- */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/* -------------------- Indexes -------------------- */

// Each artist can reuse common coupon names
couponSchema.index(
  { artistId: 1, code: 1 },
  { unique: true }
);

// Fast coupon validation
couponSchema.index({
  artistId: 1,
  isActive: 1,
  expiresAt: 1,
});

export const Coupon = mongoose.model("Coupon", couponSchema);