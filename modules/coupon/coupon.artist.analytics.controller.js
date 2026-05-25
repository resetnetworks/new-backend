// coupon.artist.analytics.controller.js

import {
  getArtistCouponAnalytics,
  getSingleArtistCouponAnalytics,
} from "./coupon.artist.analytics.service.js";

/* -------------------- All -------------------- */
export const getArtistCouponAnalyticsController = async (req, res) => {
  const artistId = req.user.artistId;

  const data = await getArtistCouponAnalytics(artistId);

  res.json({
    success: true,
    data,
  });
};

/* -------------------- Single -------------------- */
export const getSingleArtistCouponAnalyticsController = async (
  req,
  res
) => {
  const artistId = req.user.artistId;

  const data = await getSingleArtistCouponAnalytics({
    artistId,
    couponId: req.params.id,
  });

  res.json({
    success: true,
    data: data[0] || {},
  });
};