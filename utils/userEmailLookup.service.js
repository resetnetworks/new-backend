import { User } from "../models/User.js";

export const getUserEmailById = async (userId) => {
  const user = await User.findById(userId).select("email");

  if (!user) {
    throw new Error(`User not found for email lookup: ${userId}`);
  }

  return user.email;
};