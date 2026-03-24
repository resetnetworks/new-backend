// coupon.admin.routes.js

import express from "express";
import {
  createCouponController,
  updateCouponController,
  disableCouponController,
  getCouponsController,
} from "./coupon.admin.controller.js";

import { protect, authorizeRoles } from "../../middlewares/auth.middleware.js";

const router = express.Router();

/* -------------------- Apply Auth -------------------- */
router.use(protect, authorizeRoles("admin"));

/* -------------------- Routes -------------------- */
router.post("/", createCouponController);
router.patch("/:id", updateCouponController);
router.delete("/:id", disableCouponController);
router.get("/", getCouponsController);

export default router;