export const shapeAudienceUser = (user) => ({
   id: user._id,
   name: user.name,
   email: user.email,
   avatar: user.avatar,
   role: user.role,
   createdAt: user.createdAt,
   lastLoginAt: user.lastLoginAt
});