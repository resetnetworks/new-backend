
// coupon.artist.analytics.routes.js

import express from "express";
import {
  getArtistCouponAnalyticsController,
  getSingleArtistCouponAnalyticsController,
} from "./coupon.artist.analytics.controller.js";

import { protect, authorizeRoles } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("artist"));

router.get("/", getArtistCouponAnalyticsController);
router.get("/:id", getSingleArtistCouponAnalyticsController);

export default router;