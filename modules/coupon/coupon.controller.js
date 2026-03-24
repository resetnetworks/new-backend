// coupon.controller.js

import { applyCoupon } from "./coupon.service.js";

export const applyCouponController = async (req, res) => {
  const userId = req.user._id;

  const { code, amount, type, artistId } = req.body;

  const result = await applyCoupon({
    code,
    userId,
    amount,
    type,
    artistId,
  });

  return res.json({
    success: true,
    data: result,
  });
};