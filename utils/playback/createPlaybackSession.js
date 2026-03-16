import { randomUUID } from "crypto";
import { PlaybackSession } from "../../models/PlaybackSession.js";

export const createPlaybackSession = async ({ userId, songId }) => {

  const sessionId = randomUUID();

  const session = await PlaybackSession.create({
    sessionId,
    userId,
    songId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
  });

  return session;
};