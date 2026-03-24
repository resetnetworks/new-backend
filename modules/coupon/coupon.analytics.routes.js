// coupon.analytics.routes.js

import express from "express";
import {
  getCouponAnalyticsController,
  getGlobalCouponStatsController,
  getSingleCouponAnalyticsController,
} from "./coupon.analytics.controller.js";

import { protect, authorizeRoles } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin"));

router.get("/", getCouponAnalyticsController);
router.get("/global", getGlobalCouponStatsController);
router.get("/:id", getSingleCouponAnalyticsController);

export default router;