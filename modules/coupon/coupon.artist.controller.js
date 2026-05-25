// coupon.artist.controller.js

import {
  createArtistCoupon,
  getArtistCoupons,
  updateArtistCoupon,
  disableArtistCoupon,
} from "./coupon.artist.service.js";

/* -------------------- Create -------------------- */
export const createArtistCouponController = async (req, res) => {
  const artistId = req.user.artistId;

  const result = await createArtistCoupon({
    artistId,
    payload: req.body,
  });

  res.status(201).json({
    success: true,
    data: result,
  });
};

/* -------------------- List -------------------- */
export const getArtistCouponsController = async (req, res) => {
  const artistId = req.user.artistId;

  const { page, limit } = req.query;

  const result = await getArtistCoupons({
    artistId,
    page: Number(page) || 1,
    limit: Number(limit) || 10,
  });

  res.json({
    success: true,
    ...result,
  });
};

/* -------------------- Update -------------------- */
export const updateArtistCouponController = async (req, res) => {
  const artistId = req.user.artistId;

  const result = await updateArtistCoupon({
    artistId,
    couponId: req.params.id,
    updates: req.body,
  });

  res.json({
    success: true,
    data: result,
  });
};

/* -------------------- Disable -------------------- */
export const disableArtistCouponController = async (req, res) => {
  const artistId = req.user.artistId;

  const result = await disableArtistCoupon({
    artistId,
    couponId: req.params.id,
  });

  res.json({
    success: true,
    data: result,
  });
};