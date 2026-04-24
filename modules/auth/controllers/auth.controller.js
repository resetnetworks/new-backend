import { User } from "../../../models/User.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";

import generateToken from "../../../utils/generateToken.js";
import { sendMail } from "../../../utils/sendResetPassMail.js";

import { BadRequestError, UnauthorizedError } from "../../../errors/index.js";
import { shapeAuthUser } from "../dto/auth.dto.js";

import { generateRefreshToken } from "../../../utils/generateRefreshToken.js";


// ===================================================================
// @desc    Register a new user
// @route   POST /api/v2/auth/register
// @access  Public
// ===================================================================
export const registerUser = async (req, res) => {
  const { name, email, password, dob } = req.body;

  // 1️⃣ Check if user already exists
  const existingUser = await User.findOne({ email }).lean();
  if (existingUser) {
    throw new BadRequestError("User already exists");
  }

  // 2️⃣ Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 3️⃣ Create user
  const user = await User.create({
    name,
    email,
    dob,
    password: hashedPassword,
  });

  // 4️⃣ Generate JWT
  const token = generateToken(user, res);
  await generateRefreshToken(user, res);

  // 5️⃣ Shape auth
  // -safe response
  const authUser = shapeAuthUser(user.toObject());

  res.status(StatusCodes.CREATED).json({
    user: authUser,
    token,
    message: "User registered successfully",
  });
};


// ===================================================================
// @desc    Authenticate user & issue token
// @route   POST /api/v2/auth/login
// @access  Public
// ===================================================================
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  // 1️⃣ Fetch user with password
  const user = await User.findOne({ email }).select("+password +role");

  // 2️⃣ Dummy hash to prevent timing attacks
  const dummyHash =
    "$2b$10$C.wq7D6vZT0eJZK3x7zCfuM8CyqOajwX4gO8hUO9gZ.2B0uB1dYx6";

  const passwordToCompare = user ? user.password : dummyHash;
  const isMatch = await bcrypt.compare(password, passwordToCompare);

  if (!user || !isMatch) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // 3️⃣ Generate JWT
  const token = generateToken(user, res);
  await generateRefreshToken(user, res);

  // 4️⃣ Shape auth-safe response
  const authUser = shapeAuthUser(user.toObject());

  res.status(StatusCodes.OK).json({
    user: authUser,
    token,
    message: "User logged in successfully",
  });
};


// ===================================================================
// @desc    Logout user
// @route   GET /api/v2/auth/logout
// @access  Private
// ===================================================================
export const logoutUser = async (req, res) => {
  const user = req.user;

  if (user) {
    user.refreshToken = undefined;
    user.refreshTokenExpire = undefined;

    await user.save({ validateBeforeSave: false });
  }

  // Clear access token cookie
  res.cookie("token", "", {
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  // Clear refresh token cookie
  res.cookie("refreshToken", "", {
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  res.status(StatusCodes.OK).json({
    message: "Logged out successfully",
  });
};



// ===================================================================
// @desc    Send password reset link
// @route   POST /api/v2/auth/forgot-password
// @access  Public
// ===================================================================
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new BadRequestError("User not found");
  }

  // 1️⃣ Generate reset token
  const resetToken = crypto.randomBytes(20).toString("hex");

  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 mins

  await user.save({ validateBeforeSave: false });

  // 2️⃣ Send reset email
  const resetURL = `${process.env.FRONTEND_URL_WITHOUT_HOME}/reset-password/${resetToken}`;

  const message = `You requested a password reset.\n\nReset your password here:\n${resetURL}`;

  await sendMail(user.email, "Reset Your Password", message);

  res.status(StatusCodes.OK).json({
    message: "Reset link sent to your email",
  });
};

// ===================================================================
// @desc    Reset password using token
// @route   PUT /api/v2/auth/reset-password/:token
// @access  Public
// ===================================================================
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    throw new BadRequestError("Token is invalid or expired");
  }

  // 1️⃣ Update password
  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  res.status(StatusCodes.OK).json({
    message: "Password reset successful",
  });
};


// ===================================================================
// @desc    Change password (old -> new)
// @route   PUT /api/v2/auth/change-password
// @access  Private
// ===================================================================
export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // 1️⃣ Fetch user with password
  const user = await User.findById(req.user.id).select("+password");

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  // 2️⃣ Compare old password
  const isMatch = await bcrypt.compare(oldPassword, user.password);

  if (!isMatch) {
    throw new UnauthorizedError("Old password is incorrect");
  }

  // 3️⃣ Prevent same password reuse (optional but recommended)
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new BadRequestError(
      "New password must be different from old password"
    );
  }

  // 4️⃣ Hash & update password
  user.password = await bcrypt.hash(newPassword, 10);

  await user.save();

  // 5️⃣ Shape safe response
  const authUser = shapeAuthUser(user.toObject());

  res.status(StatusCodes.OK).json({
    user: authUser,
    message: "Password changed successfully",
  });
};

// ===================================================================
// @desc    Refresh access token
// @route   POST /api/v2/auth/refresh-token
// @access  Public (uses refresh token cookie)
// ===================================================================
export const refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new UnauthorizedError("Refresh token missing");
  }

  let decoded;
  try {
    decoded = jwt.verify(
      refreshToken,
      process.env.jwt_secret_refresh
    );
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const user = await User.findById(decoded.id).select(
    "+refreshToken +refreshTokenExpire"
  );

  if (
    !user ||
    !user.refreshToken ||
    user.refreshTokenExpire < Date.now()
  ) {
    throw new UnauthorizedError("Refresh token expired");
  }

  const isValid = await bcrypt.compare(
    refreshToken,
    user.refreshToken
  );

  if (!isValid) {
    throw new UnauthorizedError("Refresh token mismatch");
  }

  // 🔁 Issue new access token ONLY
  // const newAccessToken = generateToken(user, res);

  // 🔁 ROTATE TOKENS
  await generateRefreshToken(user, res);
  generateToken(user, res);

  res.status(200).json({
    message: "Access token refreshed",
  });
};

// ===================================================================
// @desc    Google OAuth callback
// @route   GET /api/v2/auth/google/callback
// @access  Public
// ===================================================================
export const googleAuthCallback = async (req, res) => {
  try {
    const { user, isNewUser } = req.user || {};

    if (!user) {
      return res.redirect(
        `${process.env.CLIENT_URL}/login?error=google_auth_failed`
      );
    }

    generateToken(user, res);
    await generateRefreshToken(user, res);

    const redirectUrl = `${process.env.CLIENT_URL}/auth/callback?newUser=${isNewUser}`;
    res.redirect(redirectUrl);
  } catch (error) {
    res.redirect(
      `${process.env.CLIENT_URL}/login?error=callback_failed`
    );
  }
};
