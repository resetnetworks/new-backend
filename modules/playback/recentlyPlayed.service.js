import { RecentlyPlayed } from "../../models/RecentlyPlayed.js";

const MAX_RECENT = 50;

export const updateRecentlyPlayed = async ({ userId, songId }) => {

  if (!userId) return;

  const doc = await RecentlyPlayed.findOne({ userId });

  if (!doc) {
    await RecentlyPlayed.create({
      userId,
      songs: [{ songId }]
    });
    return;
  }

  // remove duplicate if exists
  doc.songs = doc.songs.filter(
    (s) => String(s.songId) !== String(songId)
  );

  // add new song to front
  doc.songs.unshift({
    songId,
    playedAt: new Date()
  });

  // enforce limit
  if (doc.songs.length > MAX_RECENT) {
    doc.songs = doc.songs.slice(0, MAX_RECENT);
  }

  await doc.save();
};