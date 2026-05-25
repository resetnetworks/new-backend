// modules/coupon/coupon.service.js

/* -------------------- Imports -------------------- */
import { Coupon } from "./coupon.model.js";
import { CouponUsage } from "./couponUsage.model.js";
import {
  CouponInvalidError,
  CouponExpiredError,
  CouponNotStartedError,
  CouponNotApplicableError,
  CouponUsageExceededError,
} from "./coupon.errors.js";


/* -------------------- Private Helpers -------------------- */


/* -------------------- Step 1: Fetch -------------------- */
const getCouponOrThrow = async (code) => {
  const coupon = await Coupon.findOne({ code }).lean();

  if (!coupon || !coupon.isActive) {
    throw new CouponInvalidError("Invalid coupon code");
  }

  return coupon;
};

/* -------------------- Step 2: Time Validation -------------------- */
const validateTimeWindow = (coupon) => {
  const now = new Date();

  if (coupon.validFrom && now < coupon.validFrom) {
    throw new CouponNotStartedError("Coupon not started yet");
  }

  if (coupon.validUntil && now > coupon.validUntil) {
    throw new CouponExpiredError("Coupon expired");
  }
};

/* -------------------- Step 3: Applicability -------------------- */
const validateApplicability = ({ coupon, type, artistId }) => {
  if (
    coupon.applicableTo !== "all" &&
    coupon.applicableTo !== type
  ) {
    throw new CouponNotApplicableError("Coupon not valid for this type");
  }

  if (
    coupon.artistId &&
    String(coupon.artistId) !== String(artistId)
  ) {
    throw new CouponNotApplicableError("Coupon not valid for this artist");
  }
};

/* -------------------- Step 4: Usage -------------------- */
const validateUsage = async ({ coupon, userId }) => {
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new CouponUsageExceededError("Coupon usage limit reached");
  }

  if (coupon.perUserLimit) {
    const usageCount = await CouponUsage.countDocuments({
      couponId: coupon._id,
      userId,
    });

    if (usageCount >= coupon.perUserLimit) {
      throw new CouponUsageExceededError("Coupon already used");
    }
  }
};

/* -------------------- Step 5: Amount Constraints -------------------- */
const validateMinOrder = ({ coupon, amount }) => {
  if (coupon.minOrderAmount && amount < coupon.minOrderAmount) {
    throw new CouponNotApplicableError("Minimum order not met");
  }
};

/* -------------------- Step 6: Discount Calculation -------------------- */
const calculateDiscount = ({ coupon, amount }) => {
  let discount = 0;

  if (coupon.type === "percentage") {
    discount = (amount * coupon.value) / 100;

    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = coupon.value;
  }

  const finalAmount = Math.max(0, amount - discount);

  return { discount, finalAmount };
};


/* -------------------- Public API -------------------- */

export const applyCoupon = async ({
  code,
  userId,
  amount,
  type,
  artistId,
}) => {
  const coupon = await getCouponOrThrow(code);

  validateTimeWindow(coupon);
  validateApplicability({ coupon, type, artistId });
  validateMinOrder({ coupon, amount });

  await validateUsage({ coupon, userId });

  /* 🔥 NEW STEP */
  await validateEligibility({ coupon, userId });

  const { discount, finalAmount } = calculateDiscount({
    coupon,
    amount,
  });

  return {
    couponId: coupon._id,
    code: coupon.code,
    discount,
    finalAmount,
    originalAmount: amount,
  };
};

const getUserCouponContext = async (userId) => {
  // depends on your schema
  const [hasPurchases, hasSubscriptions] = await Promise.all([
    Transaction.exists({
      userId,
      type: { $in: ["song", "album"] },
      status: "success",
    }),
    Subscription.exists({
      userId,
      status: "active",
    }),
  ]);

  return {
    hasPurchases: !!hasPurchases,
    hasSubscriptions: !!hasSubscriptions,
  };
};

const validateEligibility = async ({ coupon, userId }) => {
  if (!coupon.eligibility && !coupon.firstTimeOnly) return;

  const context = await getUserCouponContext(userId);

  /* -------------------- Legacy Support -------------------- */
  if (coupon.firstTimeOnly && context.hasPurchases) {
    throw new CouponNotApplicableError("Only for new users");
  }

  /* -------------------- New Logic -------------------- */
  switch (coupon.eligibility) {
    case "first_purchase":
      if (context.hasPurchases) {
        throw new CouponNotApplicableError(
          "Only for first purchase"
        );
      }
      break;

    case "first_subscription":
      if (context.hasSubscriptions) {
        throw new CouponNotApplicableError(
          "Only for first subscription"
        );
      }
      break;
  }
};