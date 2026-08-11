import jwt from "jsonwebtoken";
import { User } from "../../../models/User.js";

export const authenticateUser = async (req, res, next) => {
  try {
    const accessToken =
      req.cookies.token ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!accessToken) {
      return res.status(401).json({
        message: "Access token missing",
        code: "NO_ACCESS_TOKEN",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(accessToken, process.env.jwt_secret);
    } catch (err) {
      return res.status(401).json({
        message: "Access token expired or invalid",
        code: "ACCESS_TOKEN_EXPIRED",
      });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    req.user.role = user.role;
    req.user.artistId = user.artistId;

    next();
  } catch (err) {
    res.status(500).json({ message: "Authentication failed" });
  }
};
