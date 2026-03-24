// coupon.artist.routes.js

import express from "express";
import {
  createArtistCouponController,
  getArtistCouponsController,
  updateArtistCouponController,
  disableArtistCouponController,
} from "./coupon.artist.controller.js";

import { protect, authorizeRoles } from "../../middlewares/auth.middleware.js";

const router = express.Router();

/* -------------------- Artist Only -------------------- */
router.use(protect, authorizeRoles("artist"));

router.post("/", createArtistCouponController);
router.get("/", getArtistCouponsController);
router.patch("/:id", updateArtistCouponController);
router.delete("/:id", disableArtistCouponController);

export default router;