import { StatusCodes } from "http-status-codes";
import { getExploreFeedService, getRandomArtistWithSongsService }from "./discover.service.js";

export const getRandomArtistWithSongs = async (req, res) => {
  const result = await getRandomArtistWithSongsService(req.query);

  return res.status(StatusCodes.OK).json({
    success: true,
    ...result,
  });
};


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