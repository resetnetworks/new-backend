export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user?.role) {
      return next(new UnauthorizedError("Authentication required"));
    }

    const userRoles = Array.isArray(req.user.role)
      ? req.user.role
      : [req.user.role];

    const isAllowed = userRoles.some(role =>
      allowedRoles.includes(role)
    );

    if (!isAllowed) {
      return next(new ForbiddenError("Access denied"));
    }

    next();
  };
};
