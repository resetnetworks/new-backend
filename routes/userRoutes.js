import express from "express";
import passport from "../middleware/passport.js";
import { authenticateUser } from "../middleware/authenticate.js";
import validate from "../middleware/validate.js";


import {
  registerUser,
  verifyRegistration,
  loginUser,
  myProfile,
  logoutUser,
  likeSong,
  updatePreferredGenres,
  forgotPassword,
  resetPassword,
  googleAuthCallback,
  getRecentlyPlayed,
  changeEmail,
  verifyEmailChange,
  changePassword,
  refreshSession,

} from "../controllers/userControllers.js";

import {
  registerValidation,
  verifyRegistrationValidation,
  loginValidation,
  updateGenresValidation,
  likeSongValidation,
  resetPasswordValidation,
} from "../validators/userValidators.js";

const router = express.Router();

// 🧾 Auth & Profile
router.post("/register", registerValidation, validate, registerUser);
router.post("/verify-registration", verifyRegistrationValidation, validate, verifyRegistration);
router.post("/login", loginValidation, validate, loginUser);
router.get("/me", authenticateUser, myProfile);
router.post("/logout", authenticateUser, logoutUser);

// 💖 Like Song
router.put(
  "/likedsong/:id",
  authenticateUser,
  likeSongValidation,
  validate,
  likeSong
);

// 🎵 Update Preferred Genres
router.put(
  "/update-genres",
  authenticateUser,
  updateGenresValidation,
  validate,
  updatePreferredGenres
);

// 🔐 Forgot / Reset Password
router.post("/forgot-password", forgotPassword);
router.post(
  "/reset-password/:token",
  resetPasswordValidation,
  validate,
  resetPassword
);

// 🌐 Google OAuth
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  googleAuthCallback
);


router.post("/refresh-session", refreshSession);

router.get("/recently-played", authenticateUser, getRecentlyPlayed);

// 📧 Change Email
router.post("/change-email", authenticateUser, changeEmail);
router.post("/verify-email-change", authenticateUser, verifyEmailChange);

// 🔑 Change Password
router.post("/change-password", authenticateUser, changePassword);


export default router;
