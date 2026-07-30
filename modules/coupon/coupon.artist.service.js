// coupon.artist.service.js

import { Coupon } from "./coupon.model.js";
import { providerDiscountMap } from "./providerDiscountMap.js";
import { BadRequestError, ForbiddenError } from "../../errors/index.js";

/* -------------------- Create -------------------- */
export const createArtistCoupon = async ({
  artistId,
  createdBy,
  payload,
}) => {
  const {
    code,
    discountType,
    discountValue,
    maxDiscount,
    appliesTo,
    eligibility,
    usageLimit,
    perUserLimit,
    minimumPurchase,
    startsAt,
    expiresAt,
  } = payload;

  /* -------------------- Authorization -------------------- */

  if (!artistId) {
    throw new ForbiddenError("Artist not authorized");
  }

  /* -------------------- Validation -------------------- */

  if (startsAt && expiresAt && new Date(startsAt) > new Date(expiresAt)) {
    throw new BadRequestError("Invalid date range");
  }

  /* -------------------- Duplicate Code -------------------- */

  const existing = await Coupon.findOne({
    artistId,
    code: code.toUpperCase(),
  });

  if (existing) {
    throw new BadRequestError("Coupon code already exists");
  }

  /* -------------------- Provider Mapping -------------------- */

  let providerIds = {};

  if (discountType === "percentage") {
    providerIds = providerDiscountMap[discountValue];

    if (!providerIds) {
      throw new BadRequestError(
        `No payment provider mapping found for ${discountValue}% discount`
      );
    }
  }

  /* -------------------- Create Coupon -------------------- */

  const coupon = await Coupon.create({
    code,
    artistId,

    discountType,
    discountValue,
    maxDiscount,

    appliesTo,
    eligibility,

    usageLimit,
    perUserLimit,
    minimumPurchase,

    startsAt,
    expiresAt,

    providerIds,

    createdBy,
  });

  return coupon;
};

/* -------------------- Get Artist Coupons -------------------- */
export const getArtistCoupons = async ({
  artistId,
  page = 1,
  limit = 10,
}) => {
  const skip = (page - 1) * limit;

  const query = {
    artistId,
  };

  const [coupons, total] = await Promise.all([
    Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Coupon.countDocuments(query),
  ]);

  return {
    data: coupons,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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

  /* -------------------- Ownership -------------------- */

  if (String(coupon.artistId) !== String(artistId)) {
    throw new ForbiddenError("Not your coupon");
  }

  /* -------------------- Protected Fields -------------------- */

  delete updates.artistId;
  delete updates.createdBy;
  delete updates.usedCount;
  delete updates.providerIds;

  /* -------------------- Validate Dates -------------------- */

  const startsAt = updates.startsAt ?? coupon.startsAt;
  const expiresAt = updates.expiresAt ?? coupon.expiresAt;

  if (
    startsAt &&
    expiresAt &&
    new Date(startsAt) > new Date(expiresAt)
  ) {
    throw new BadRequestError("Invalid date range");
  }

  /* -------------------- Duplicate Code -------------------- */

  if (
    updates.code &&
    updates.code.toUpperCase() !== coupon.code
  ) {
    const existing = await Coupon.findOne({
      artistId,
      code: updates.code.toUpperCase(),
      _id: { $ne: couponId },
    });

    if (existing) {
      throw new BadRequestError("Coupon code already exists");
    }

    updates.code = updates.code.toUpperCase();
  }

  /* -------------------- Provider Mapping -------------------- */

  const discountType =
    updates.discountType ?? coupon.discountType;

  const discountValue =
    updates.discountValue ?? coupon.discountValue;

  if (discountType === "percentage") {
    const providerIds =
      providerDiscountMap[discountValue];

    if (!providerIds) {
      throw new BadRequestError(
        `No payment provider mapping found for ${discountValue}% discount`
      );
    }

    updates.providerIds = providerIds;
  } else {
    updates.providerIds = {};
  }

  /* -------------------- Update -------------------- */

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

  if (!coupon.isActive) {
    throw new BadRequestError("Coupon is already disabled");
  }

  coupon.isActive = false;

  await coupon.save();

  return coupon;
};


/* -------------------- Enable -------------------- */
export const enableArtistCoupon = async ({
  artistId,
  couponId,
}) => {
  const coupon = await Coupon.findById(couponId);

  if (!coupon) {
    throw new BadRequestError("Coupon not found");
  }

  /* -------------------- Ownership -------------------- */
  if (String(coupon.artistId) !== String(artistId)) {
    throw new ForbiddenError("Not your coupon");
  }

  if (coupon.isActive) {
    throw new BadRequestError("Coupon is already enabled");
  }

  coupon.isActive = true;

  await coupon.save();

  return coupon;
};