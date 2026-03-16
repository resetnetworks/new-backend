import { playbackStartedService } from "./playback.service.js";

export const playbackStarted = async (req, res) => {

  const { sessionId, songId } = req.body;
  const userId = req.user?._id || null;

  const result = await playbackStartedService({
    sessionId,
    userId,
    songId
  });

  res.json(result);
};