import { Album } from "../models/album.model.js";
import { Song } from "../models/song.model.js";
import { shapeAlbumResponse } from "../../dto/album.dto.js";
import { shapeSongResponse } from "../../dto/song.dto.js";

export const getExploreFeedService = async () => {
  // fetch in parallel
  const [albums, songs] = await Promise.all([
    Album.aggregate([{ $sample: { size: 10 } }]),
    Song.aggregate([{ $sample: { size: 10 } }]),
  ]);

  // shape
  const albumFeed = albums.map(a => ({
    type: "album",
    data: shapeAlbumResponse(a),
  }));

  const songFeed = songs.map(s => ({
    type: "song",
    data: shapeSongResponse(s),
  }));

  // merge + shuffle
  const feed = [...albumFeed, ...songFeed].sort(() => Math.random() - 0.5);

  return { feed };
};