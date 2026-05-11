import { OAuth2Client } from "google-auth-library";

// iOS Google Sign-In client id (from Google Console iOS app)
const client = new OAuth2Client(process.env.GOOGLE_IOS_CLIENT_ID);

/**
 * Verify Google ID token coming ONLY from iOS native SDK
 */
export const verifyGoogleIdToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_IOS_CLIENT_ID, // 🔒 strict iOS audience
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error("Invalid Google token");
  }

  // Extra safety checks specific to native apps
  if (!payload.email || !payload.sub) {
    throw new Error("Google account missing required fields");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    emailVerified: payload.email_verified,
  };
};