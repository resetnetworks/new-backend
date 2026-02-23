import { buildCdnUrl } from "../../../utils/cdn/cdn.js";

/**
 * Shapes and sanitizes user data for AUTH responses.
 *
 * Used during:
 * - Login
 * - Register
 * - OAuth entry points
 *
 * Returns:
 * - Identity and authorization-relevant fields only
 *
 * @param {Object} user - User mongoose document or plain object
 * @returns {Object|null}
 */
export const shapeAuthUser = (user) => {
  if (!user) return null;

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage
      ? buildCdnUrl(user.profileImage)
      : null,
    createdAt: user.createdAt,
  };
};
