import appleSignin from "apple-signin-auth";

export const verifyAppleIdentityToken = async (identityToken) => {
  const appleData = await appleSignin.verifyIdToken(identityToken, {
    audience: process.env.APPLE_CLIENT_ID, // bundle id
    ignoreExpiration: false,
  });

  return {
    appleId: appleData.sub,
    email: appleData.email,
    emailVerified: appleData.email_verified === "true",
  };
};