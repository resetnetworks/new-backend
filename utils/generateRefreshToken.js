import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export const generateRefreshToken = async (user, res) => {
  const refreshToken = jwt.sign(
    { id: user._id,
      // role: user.role,
      // artistId: user.artistId || null,
    },
    process.env.jwt_secret_refresh,
    { expiresIn: "7d" }
  );

  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

  user.refreshToken = hashedRefreshToken;
  user.refreshTokenExpire = Date.now() + 7 * 24 * 60 * 60 * 1000;  // 7days
  await user.save({ validateBeforeSave: false });

  res.cookie("refreshToken", refreshToken, {
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7days
    httpOnly: true,
    sameSite: "strict"
  });
};
