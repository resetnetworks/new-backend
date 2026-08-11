import express from "express";
import passport from "../../../middleware/passport.js";

import {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshAccessToken,
  googleAuthCallback,
} from "../controllers/auth.controller.js";

import { authenticateUser } from "../middlewares/auth.middleware.js";
import validate from "../../../middleware/validate.js";

import {
  registerValidation,
  loginValidation,
  resetPasswordValidation,
} from "../../../validators/userValidators.js";

const router = express.Router();


// ======================================================
// Auth Routes v2
// Base path: /api/v2/auth
// ======================================================

// Register
router.post("/register", registerValidation, validate, registerUser);

// Login
router.post("/login", loginValidation, validate, loginUser);

// Logout
router.post("/logout", authenticateUser, logoutUser);

// Forgot password
router.post("/forgot-password", forgotPassword);

// Reset password
router.put(
  "/reset-password/:token",
  resetPasswordValidation,
  validate,
  resetPassword
);

// Change Password
router.put(
  "/change-password",
  authenticateUser,
  changePassword
);

// Refresh Access Token
router.post("/refresh-token", refreshAccessToken);


// Google OAut
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  googleAuthCallback
);

export default router;
