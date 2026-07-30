import express from "express";
import {
  createArtistCouponController,
  getArtistCouponsController,
  updateArtistCouponController,
  disableArtistCouponController,
  enableArtistCouponController,
} from "./coupon.artist.controller.js";

import { authenticateUser } from "../../middleware/authenticate.js";
import { requireArtist } from "../../middleware/requireArtist.js";

const router = express.Router();

router.use(authenticateUser, requireArtist);

router.post("/", createArtistCouponController);

router.get("/", getArtistCouponsController);

router.patch("/:id", updateArtistCouponController);

router.patch("/:id/disable", disableArtistCouponController);

router.patch("/:id/enable", enableArtistCouponController);

export default router;