import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import logger from "../utils/logger.js";

export const authenticateUser = async (req, res, next) => {
 
  try {
    let token =
      req.header("Authorization")?.replace("Bearer ", "") || req.cookies.token;
      
   

    if (!token) {
      req.user = null;
      return next(); // Allow unauthenticated access, controllers will handle it
    }

    let decodedData;
    try {
      decodedData = jwt.verify(token, process.env.jwt_secret);
    } catch (err) {
      req.user = null;
      return next(); // Invalid token, treat as unauthenticated
    }

 
 

    if (!decodedData || !decodedData.id) {
      return res.status(401).json({
        message: "Invalid token payload. Please login again.",
      });
    }

    const user = await User.findById(decodedData.id).select("-password");
  

    if (!user) {
      return res.status(401).json({
        message: "User not found. Please login.",
      });
    }

        // 🔥 ROLE CHANGE DETECTION
  if (decodedData.roleVersion !== user.roleVersion) {
    return res.status(401).json({
      code: "ROLE_CHANGED",
      message: "Your role has been updated. Please refresh session.",
    });
  }

    // IMPORTANT FIX HERE 
    req.user = {
      ...user.toObject(),
      role: decodedData.role,
      artistId: decodedData.artistId,
    } || null;
    
 

   
    next();
  } catch (error) {
    res.status(500).json({
      message: "Internal server error during authentication.",
    });
  }
};


