// coupon.artist.analytics.service.js

import { Transaction } from "../payment/transaction.model.js";

export const getArtistCouponAnalytics = async (artistId) => {
  return await Transaction.aggregate([
    {
      $match: {
        status: "success",
        couponId: { $ne: null },
        artistId: artistId, // 🔥 IMPORTANT
      },
    },
    {
      $group: {
        _id: "$couponId",
        totalUsage: { $sum: 1 },

        totalRevenue: { $sum: "$finalAmount" },

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
    { $unwind: "$coupon" },

    /* 🔥 DOUBLE SAFETY CHECK */
    {
      $match: {
        "coupon.artistId": artistId,
      },
    },

    {
      $project: {
        couponId: "$_id",
        code: "$coupon.code",
        totalUsage: 1,
        totalRevenue: 1,
        totalDiscount: 1,
      },
    },

    {
      $sort: { totalUsage: -1 },
    },
  ]);
};



export const getSingleArtistCouponAnalytics = async ({
  artistId,
  couponId,
}) => {
  return await Transaction.aggregate([
    {
      $match: {
        couponId,
        artistId,
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