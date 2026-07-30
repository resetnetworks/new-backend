// coupon.controller.js

import { applyCoupon } from "./coupon.checkout.service.js";

export const applyCouponController = async (req, res) => {
  const userId = req.user._id;

  const { code, itemType, itemId } = req.body;

  const result = await applyCoupon({
    code,
    userId,
    itemType,
    itemId,
  });

  return res.json({
    success: true,
    data: result,
  });
};