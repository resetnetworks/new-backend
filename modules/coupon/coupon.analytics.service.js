// coupon.analytics.service.js

import { Transaction } from "../payment/transaction.model.js";
import mongoose from "mongoose";

export const getCouponAnalytics = async () => {
  const result = await Transaction.aggregate([
    {
      $match: {
        status: "success",
        couponId: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$couponId",

        totalUsage: { $sum: 1 },

        totalOriginalAmount: { $sum: "$originalAmount" },
        totalFinalAmount: { $sum: "$finalAmount" },

        totalDiscount: {
          $sum: {
            $subtract: ["$originalAmount", "$finalAmount"],
          },
        },
      },
    },
    {
      $lookup: {
        from: "coupons",
        localField: "_id",
        foreignField: "_id",
        as: "coupon",
      },
    },
    {
      $unwind: "$coupon",
    },
    {
      $project: {
        couponId: "$_id",
        code: "$coupon.code",
        totalUsage: 1,
        totalDiscount: 1,
        totalRevenue: "$totalFinalAmount",
      },
    },
    {
      $sort: { totalUsage: -1 },
    },
  ]);

  return result;
};

export const getGlobalCouponStats = async () => {
  const result = await Transaction.aggregate([
    {
      $match: {
        status: "success",
        couponId: { $ne: null },
      },
    },
    {
      $group: {
        _id: null,
        totalUsage: { $sum: 1 },
        totalOriginal: { $sum: "$originalAmount" },
        totalFinal: { $sum: "$finalAmount" },
        totalDiscount: {
          $sum: {
            $subtract: ["$originalAmount", "$finalAmount"],
          },
        },
      },
    },
  ]);

  return result[0] || {};
};

export const getSingleCouponAnalytics = async (couponId) => {
  return await Transaction.aggregate([
    {
      $match: {
        couponId: new mongoose.Types.ObjectId(couponId),
        status: "success",
      },
    },
    {
      $group: {
        _id: null,
        totalUsage: { $sum: 1 },
        totalRevenue: { $sum: "$finalAmount" },
        totalDiscount: {
          $sum: {
            $subtract: ["$originalAmount", "$finalAmount"],
          },
        },
      },
    },
  ]);
};