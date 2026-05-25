// coupon.admin.controller.js

import {
  createCoupon,
  updateCoupon,
  disableCoupon,
  getCoupons,
} from "./coupon.admin.service.js";

/* -------------------- Create -------------------- */
export const createCouponController = async (req, res) => {
  const result = await createCoupon({
    ...req.body,
    createdById: req.user._id,
  });

  res.status(201).json({
    success: true,
    data: result,
  });
};

/* -------------------- Update -------------------- */
export const updateCouponController = async (req, res) => {
  const result = await updateCoupon(req.params.id, req.body);

  res.json({
    success: true,
    data: result,
  });
};

/* -------------------- Disable -------------------- */
export const disableCouponController = async (req, res) => {
  const result = await disableCoupon(req.params.id);

  res.json({
    success: true,
    data: result,
  });
};

/* -------------------- List -------------------- */
export const getCouponsController = async (req, res) => {
  const { page, limit, isActive } = req.query;

  const result = await getCoupons({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    isActive:
      isActive === undefined ? undefined : isActive === "true",
  });

  res.json({
    success: true,
    ...result,
  });
};