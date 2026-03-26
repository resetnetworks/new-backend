import { StatusCodes } from "http-status-codes";
import { getRandomArtistWithSongsService } from "./discover.random.service.js";
import { getExploreFeedService }from "./discover.service.js";

export const getRandomArtistWithSongs = async (req, res) => {
  const result = await getRandomArtistWithSongsService(req.query);

  return res.status(StatusCodes.OK).json({
    success: true,
    ...result,
  });
};

/*
export const getExploreFeed = async (req, res) => {
  try {
    // 🎲 Randomly fetch 10 albums and 10 songs
    const [albums, songs] = await Promise.all([
      Album.aggregate([{ $sample: { size: 10 } }]),
      Song.aggregate([{ $sample: { size: 10 } }]),
    ]);

    // 🧩 Shape + merge + shuffle the combined feed
    const feed = [
      ...albums.map(a => ({ type: "album", data: shapeAlbumResponse(a) })),
      ...songs.map(s => ({ type: "song", data: shapeSongResponse(s) })),
    ].sort(() => Math.random() - 0.5);

    res.status(StatusCodes.OK).json({ success: true, feed });
  } catch (err) {
    console.error("Error generating explore feed:", err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load explore feed ",
    });
  }
};
*/

export const getExploreFeed = async (req, res) => {
  try {
    const result = await getExploreFeedService();

    return res.status(StatusCodes.OK).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error generating explore feed:", error);

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load explore feed",
    });
  }
};