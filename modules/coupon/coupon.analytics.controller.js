// coupon.analytics.controller.js

import {
  getCouponAnalytics,
  getGlobalCouponStats,
  getSingleCouponAnalytics,
} from "./coupon.analytics.service.js";

/* -------------------- All Coupons -------------------- */
export const getCouponAnalyticsController = async (req, res) => {
  const data = await getCouponAnalytics();

  res.json({
    success: true,
    data,
  });
};

/* -------------------- Global -------------------- */
export const getGlobalCouponStatsController = async (req, res) => {
  const data = await getGlobalCouponStats();

  res.json({
    success: true,
    data,
  });
};

/* -------------------- Single -------------------- */
export const getSingleCouponAnalyticsController = async (req, res) => {
  const data = await getSingleCouponAnalytics(req.params.id);

  res.json({
    success: true,
    data: data[0] || {},
  });
};