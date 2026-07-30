import { ForbiddenError } from "../errors/index.js";

export const requireArtist = (req, res, next) => {
  if (req.user && req.user.role) {
    const roles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    if (roles.includes("artist")) {
      return next();
    }
  }
  return next(new ForbiddenError("Access denied. Artist role required."));
};

export default requireArtist;
