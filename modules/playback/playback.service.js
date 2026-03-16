import { PlaybackEvent } from "../../models/PlaybackEvent.js";
import { PlaybackSession } from "../../models/PlaybackSession.js";
import { NotFoundError } from "../../errors/index.js";
import { updateRecentlyPlayed } from "./recentlyPlayed.service.js";

export const playbackStartedService = async ({ sessionId, userId, songId }) => {

  const session = await PlaybackSession.findOne({ sessionId }).lean();

  if (!session) {
    throw new NotFoundError("Invalid playback session");
  }

  await PlaybackEvent.create({
    sessionId,
    userId,
    songId,
    eventType: "playback_started"
  });

   // async update recently played
  updateRecentlyPlayed({ userId, songId });

  return { success: true };
};