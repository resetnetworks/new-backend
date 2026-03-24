// coupon.routes.js

import express from "express";
import { applyCouponController } from "./coupon.controller.js";

import { authenticateUser } from "../../middleware/authenticate.js";

const router = express.Router();

router.post("/apply", authenticateUser, applyCouponController);

export default router;