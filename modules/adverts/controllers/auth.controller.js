import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";
import { getCached, setCached } from "../../../utils/cache.js";
import { MetaConnection } from "../models/MetaConnection.model.js";
import { encrypt, decrypt } from "../utils/encryption.js";

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_API_VERSION = process.env.META_API_VERSION || "v20.0";
const META_REDIRECT_URI = process.env.META_REDIRECT_URI; // e.g. https://api.musicreset.com/api/v2/meta-ads/auth/callback
const FRONTEND_URL = process.env.FRONTEND_URL;

const OAUTH_STATE_TTL = 600;    // 10 minutes — state token validity
const AUTH_SESSION_TTL = 300;   // 5 minutes — pages stored after callback

// ---------------------------------------------------------------------------
// GET /api/v2/meta-ads/auth/url
// Generate Facebook OAuth URL for the artist to begin page connection
// ---------------------------------------------------------------------------
export const getOAuthUrl = async (req, res) => {
  const artistId = req.user?.artistId || req.user?._id;
  if (!artistId) {
    return res.status(403).json({ message: "Login required" });
  }

  // Generate a cryptographically random state token (CSRF protection)
  const state = uuidv4();

  // Store the artist's identity against the state — we'll retrieve it on callback
  await setCached(
    `meta_oauth_state:${state}`,
    { artistId: artistId.toString(), userId: req.user._id.toString() },
    OAUTH_STATE_TTL
  );

  const scopes = [
    "pages_show_list",
    "pages_manage_ads",
    "pages_read_engagement",
  ].join(",");

  const oauthUrl =
    `https://www.facebook.com/${META_API_VERSION}/dialog/oauth` +
    `?client_id=${META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}` +
    `&response_type=code`;

  return res.status(200).json({ url: oauthUrl });
};

// ---------------------------------------------------------------------------
// GET /api/v2/meta-ads/auth/callback
// Facebook redirects here after artist grants permissions.
// NO JWT auth — we identify the artist via the state token in Redis.
// ---------------------------------------------------------------------------
export const handleOAuthCallback = async (req, res) => {
  const { code, state, error } = req.query;

  // Artist denied access or error from Facebook
  if (error || !code || !state) {
    return res.redirect(`${FRONTEND_URL}/meta-ads-test?error=access_denied`);
  }

  // Verify CSRF state
  const stateData = await getCached(`meta_oauth_state:${state}`);
  if (!stateData) {
    return res.redirect(`${FRONTEND_URL}/meta-ads-test?error=state_expired`);
  }

  const { artistId } = stateData;

  try {
    // --- Step 1: Exchange auth code for short-lived user token ---
    const tokenParams = new URLSearchParams({
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      redirect_uri: META_REDIRECT_URI,
      code,
    });

    const shortLivedRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${tokenParams}`
    );
    const shortLivedData = await shortLivedRes.json();

    if (shortLivedData.error) {
      console.error("Short-lived token error:", shortLivedData.error);
      return res.redirect(`${FRONTEND_URL}/meta-ads-test?error=token_exchange_failed`);
    }

    // --- Step 2: Exchange for long-lived token (~60 days) ---
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET,
      fb_exchange_token: shortLivedData.access_token,
    });

    const longLivedRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?${longLivedParams}`
    );
    const longLivedData = await longLivedRes.json();

    if (longLivedData.error) {
      console.error("Long-lived token error:", longLivedData.error);
      return res.redirect(`${FRONTEND_URL}/meta-ads-test?error=token_exchange_failed`);
    }

    console.log("[Meta] Long-lived token response fields:", Object.keys(longLivedData), "| expires_in:", longLivedData.expires_in);
    const { access_token: longLivedToken, expires_in } = longLivedData;
    // expires_in can be missing or a string — fall back to 60 days (FB default for long-lived tokens)
    const expiresInSeconds = Number(expires_in) || 60 * 24 * 60 * 60;
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    // --- Step 3: Get Facebook user ID ---
    const userRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me?fields=id,name&access_token=${longLivedToken}`
    );
    const userData = await userRes.json();

    if (userData.error) {
      console.error("User fetch error:", userData.error);
      return res.redirect(`${FRONTEND_URL}/meta-ads-test?error=user_fetch_failed`);
    }

    // --- Step 4: Fetch all Pages this user manages ---
    const pagesRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/accounts` +
      `?fields=id,name,picture%7Burl%7D,fan_count,category,access_token` +
      `&access_token=${longLivedToken}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error || !pagesData.data || pagesData.data.length === 0) {
      console.error("Pages fetch error:", pagesData.error);
      return res.redirect(`${FRONTEND_URL}/meta-ads-test?error=no_pages_found`);
    }

    // --- Step 5: Store auth session in Redis for the page selection step ---
    // The page access_token is stored here temporarily (never sent to frontend)
    const sessionPages = pagesData.data.map((page) => ({
      id: page.id,
      name: page.name,
      picture: page.picture?.data?.url || null,
      fanCount: page.fan_count || 0,
      category: page.category || "",
      accessToken: page.access_token,
    }));

    await setCached(
      `meta_auth_session:${artistId}`,
      {
        facebookUserId: userData.id,
        longLivedToken,
        tokenExpiresAt,
        pages: sessionPages,
      },
      AUTH_SESSION_TTL
    );

    // --- Step 6: Also save to MongoDB immediately so we can inspect the data ---
    // Uses the first page as a placeholder. isConnected=false until user selects a page.
    const firstPage = sessionPages[0];
    try {
      await MetaConnection.findOneAndUpdate(
        { artistId },
        {
          artistId,
          facebookUserId: userData.id,
          facebookPageId: firstPage.id,
          facebookPageName: firstPage.name,
          facebookPagePicture: firstPage.picture || "",
          facebookPageCategory: firstPage.category || "",
          facebookPageFanCount: firstPage.fanCount || 0,
          pageAccessToken: encrypt(firstPage.accessToken),
          userAccessToken: encrypt(longLivedToken),
          tokenExpiresAt: new Date(tokenExpiresAt),
          isConnected: false, // pending — user hasn't selected their page yet
          connectedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      console.log(`✅ [Meta] Preliminary DB save done for artistId: ${artistId}`);
    } catch (dbErr) {
      console.error("⚠️ [Meta] MongoDB preliminary save failed:", dbErr.message);
      // Don't block the flow — Redis session is still valid for page selection
    }

    // Redirect to frontend page selection screen
    return res.redirect(`${FRONTEND_URL}/meta-ads-test?step=select`);

  } catch (err) {
    console.error("Meta OAuth callback error:", err.message, err.stack);
    return res.redirect(`${FRONTEND_URL}/meta-ads-test?error=server_error`);
  }
};

// ---------------------------------------------------------------------------
// GET /api/v2/meta-ads/auth/pages
// Returns the list of pages from the OAuth session (after callback).
// Frontend calls this immediately on the select-page screen.
// ---------------------------------------------------------------------------
export const getAvailablePages = async (req, res) => {
  const artistId = (req.user?.artistId || req.user?._id)?.toString();
  if (!artistId) {
    return res.status(403).json({ message: "Login required" });
  }

  const session = await getCached(`meta_auth_session:${artistId}`);
  if (!session) {
    return res.status(400).json({
      message: "Session expired. Please reconnect your Facebook account.",
      code: "SESSION_EXPIRED",
    });
  }

  // Return page metadata only — access tokens are NEVER sent to the frontend
  return res.status(200).json({
    pages: session.pages.map((p) => ({
      id: p.id,
      name: p.name,
      picture: p.picture,
      fanCount: p.fanCount,
      category: p.category,
    })),
  });
};

// ---------------------------------------------------------------------------
// POST /api/v2/meta-ads/auth/select-page
// Artist selects which page to use for their ads. Tokens are encrypted and saved.
// ---------------------------------------------------------------------------
export const selectPage = async (req, res) => {
  const artistId = (req.user?.artistId || req.user?._id)?.toString();
  if (!artistId) {
    return res.status(403).json({ message: "Login required" });
  }

  const { pageId } = req.body;
  if (!pageId) {
    return res.status(400).json({ message: "pageId is required" });
  }

  // Retrieve the auth session
  const session = await getCached(`meta_auth_session:${artistId}`);
  if (!session) {
    return res.status(400).json({
      message: "Session expired. Please reconnect your Facebook account.",
      code: "SESSION_EXPIRED",
    });
  }

  const selectedPage = session.pages.find((p) => p.id === pageId);
  if (!selectedPage) {
    return res.status(400).json({ message: "Selected page not found in your authorized pages" });
  }

  // Encrypt both tokens before saving to MongoDB
  const encryptedPageToken = encrypt(selectedPage.accessToken);
  const encryptedUserToken = encrypt(session.longLivedToken);

  // Upsert MetaConnection — one record per artist
  const connection = await MetaConnection.findOneAndUpdate(
    { artistId },
    {
      artistId,
      facebookUserId: session.facebookUserId,
      facebookPageId: selectedPage.id,
      facebookPageName: selectedPage.name,
      facebookPagePicture: selectedPage.picture || "",
      facebookPageCategory: selectedPage.category || "",
      facebookPageFanCount: selectedPage.fanCount || 0,
      pageAccessToken: encryptedPageToken,
      userAccessToken: encryptedUserToken,
      tokenExpiresAt: new Date(session.tokenExpiresAt),
      isConnected: true,
      connectedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return res.status(200).json({
    message: "Facebook Page connected successfully",
    page: {
      id: connection.facebookPageId,
      name: connection.facebookPageName,
      picture: connection.facebookPagePicture,
      category: connection.facebookPageCategory,
      fanCount: connection.facebookPageFanCount,
    },
  });
};

// ---------------------------------------------------------------------------
// GET /api/v2/meta-ads/auth/status
// Check if the artist has an active Facebook connection
// ---------------------------------------------------------------------------
export const getConnectionStatus = async (req, res) => {
  const artistId = req.user?.artistId || req.user?._id;
  if (!artistId) {
    return res.status(403).json({ message: "Login required" });
  }

  const connection = await MetaConnection.findOne({ artistId }).select(
    "-pageAccessToken -userAccessToken" // never return tokens
  );

  if (!connection || !connection.isConnected) {
    return res.status(200).json({ connected: false });
  }

  // Auto-detect expiry
  if (connection.tokenExpiresAt < new Date()) {
    await MetaConnection.findOneAndUpdate({ artistId }, { isConnected: false });
    return res.status(200).json({
      connected: false,
      reason: "token_expired",
      message: "Your Facebook connection has expired. Please reconnect.",
    });
  }

  return res.status(200).json({
    connected: true,
    page: {
      id: connection.facebookPageId,
      name: connection.facebookPageName,
      picture: connection.facebookPagePicture,
      category: connection.facebookPageCategory,
      fanCount: connection.facebookPageFanCount,
    },
    connectedAt: connection.connectedAt,
    tokenExpiresAt: connection.tokenExpiresAt,
  });
};

// ---------------------------------------------------------------------------
// DELETE /api/v2/meta-ads/auth/disconnect
// Soft disconnect — marks as disconnected, keeps the record
// ---------------------------------------------------------------------------
export const disconnect = async (req, res) => {
  const artistId = req.user?.artistId || req.user?._id;
  if (!artistId) {
    return res.status(403).json({ message: "Login required" });
  }

  const connection = await MetaConnection.findOne({ artistId });
  if (!connection) {
    return res.status(404).json({ message: "No Facebook connection found" });
  }

  await MetaConnection.findOneAndUpdate({ artistId }, { isConnected: false });

  return res.status(200).json({
    message: "Facebook Page disconnected successfully",
  });
};
