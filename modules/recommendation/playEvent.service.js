import { PlayEvent } from "./playEvents.model.js";

// call this service inside your streaming controller.

export const logPlayEvent = async ({ userId, songId }) => {
  try {
    await PlayEvent.create({
      userId,
      songId,
      playedAt: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    console.error("PlayEvent logging failed:", err.message);
  }
};