import { Coupon } from "./coupon.model.js";
import { BadRequestError } from "../../utils/errors.js";

/* -------------------- Create Coupon -------------------- */
export const createCoupon = async (payload) => {
  const {
    code,
    type,
    value,
    maxDiscount,
    applicableTo,
    artistId,
    minOrderAmount,
    usageLimit,
    perUserLimit,
    validFrom,
    validUntil,
    firstTimeOnly,
    createdById,
  } = payload;

  /* -------------------- Basic Validations -------------------- */

  if (type === "percentage" && value > 100) {
    throw new BadRequestError("Percentage cannot exceed 100");
  }

  if (validFrom && validUntil && validFrom > validUntil) {
    throw new BadRequestError("Invalid date range");
  }

  /* -------------------- Unique Code Check -------------------- */
  const existing = await Coupon.findOne({ code });

  if (existing) {
    throw new BadRequestError("Coupon code already exists");
  }

  /* -------------------- Create -------------------- */
  const coupon = await Coupon.create({
    code,
    type,
    value,
    maxDiscount,
    applicableTo,
    artistId: artistId || null,
    minOrderAmount,
    usageLimit,
    perUserLimit,
    validFrom,
    validUntil,
    firstTimeOnly,

    createdBy: "admin",
    createdById,
  });

  return coupon;
};

/* -------------------- Update Coupon -------------------- */
export const updateCoupon = async (couponId, updates) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new BadRequestError("Coupon not found");
  }

  /* Prevent dangerous updates */
  if (updates.usedCount) {
    delete updates.usedCount;
  }

  Object.assign(coupon, updates);

  await coupon.save();

  return coupon;
};

/* -------------------- Disable Coupon -------------------- */
export const disableCoupon = async (couponId) => {
  const coupon = await Coupon.findByIdAndUpdate(
    couponId,
    { isActive: false },
    { new: true }
  );

  if (!coupon) {
    throw new BadRequestError("Coupon not found");
  }

  return coupon;
};

/* -------------------- Get Coupons (Admin View) -------------------- */
export const getCoupons = async ({
  page = 1,
  limit = 10,
  isActive,
}) => {
  const query = {};

  if (typeof isActive === "boolean") {
    query.isActive = isActive;
  }

  const coupons = await Coupon.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await Coupon.countDocuments(query);

  return {
    data: coupons,
    pagination: {
      total,
      page,
      limit,
    },
  };
};