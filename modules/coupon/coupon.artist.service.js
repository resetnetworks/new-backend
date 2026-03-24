// coupon.artist.service.js

import { Coupon } from "./coupon.model.js";
import { BadRequestError, ForbiddenError } from "../../utils/errors.js";

/* -------------------- Create -------------------- */
export const createArtistCoupon = async ({
  artistId,
  payload,
}) => {
  const {
    code,
    type,
    value,
    maxDiscount,
    applicableTo,
    minOrderAmount,
    usageLimit,
    perUserLimit,
    validFrom,
    validUntil,
    firstTimeOnly,
  } = payload;

  /* -------------------- STRICT RULES -------------------- */

  if (!artistId) {
    throw new ForbiddenError("Artist not authorized");
  }

  if (applicableTo === "all") {
    throw new BadRequestError(
      "Artists cannot create global coupons"
    );
  }

  /* -------------------- Validation -------------------- */

  if (type === "percentage" && value > 100) {
    throw new BadRequestError("Percentage cannot exceed 100");
  }

  if (validFrom && validUntil && validFrom > validUntil) {
    throw new BadRequestError("Invalid date range");
  }

  /* -------------------- Unique Code -------------------- */

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
    artistId, // 🔥 forced

    minOrderAmount,
    usageLimit,
    perUserLimit,
    validFrom,
    validUntil,
    firstTimeOnly,

    createdBy: "artist",
    createdById: artistId,
  });

  return coupon;
};

/* -------------------- Get Artist Coupons -------------------- */
export const getArtistCoupons = async ({
  artistId,
  page = 1,
  limit = 10,
}) => {
  const query = {
    artistId,
    createdBy: "artist",
  };

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

/* -------------------- Update -------------------- */
export const updateArtistCoupon = async ({
  artistId,
  couponId,
  updates,
}) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new BadRequestError("Coupon not found");
  }

  /* -------------------- Ownership Check -------------------- */
  if (String(coupon.artistId) !== String(artistId)) {
    throw new ForbiddenError("Not your coupon");
  }

  /* -------------------- Prevent dangerous updates -------------------- */
  delete updates.usedCount;
  delete updates.createdBy;
  delete updates.artistId;

  Object.assign(coupon, updates);

  await coupon.save();

  return coupon;
};

/* -------------------- Disable -------------------- */
export const disableArtistCoupon = async ({
  artistId,
  couponId,
}) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new BadRequestError("Coupon not found");
  }

  if (String(coupon.artistId) !== String(artistId)) {
    throw new ForbiddenError("Not your coupon");
  }

  coupon.isActive = false;
  await coupon.save();

  return coupon;
};