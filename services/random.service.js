import { Artist } from "../models/Artist.js";
import { Song } from "../models/song.model.js";
import { StatusCodes } from "http-status-codes";
import { Album } from "../models/album.model.js";
import { shapeAlbumResponse } from "../dto/album.dto.js";
import { shapeSongResponse } from "../dto/song.dto.js";
import { shapeArtistResponse } from "../dto/artist.dto.js";
import { NotFoundError } from "../errors/index.js";
export const getRandomArtistWithSongsService = async (query) => {
  const totalArtists = await Artist.countDocuments({
    isMonetizationComplete: true,
  });

  if (!totalArtists) {
    throw new NotFoundError("No artists found");
  }

  const randomIndex = Math.floor(Math.random() * totalArtists);

  const artist = await Artist.findOne({
    isMonetizationComplete: true,
  })
    .select("_id name slug profileImageKey")
    .skip(randomIndex)
    .lean();

  if (!artist) {
    throw new NotFoundError("Random artist not found");
  }

  // pagination
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  // 🎯 ALBUMS
  const albums = await Album.find({
    artist: artist._id,
    isDeleted: { $ne: true },
  })
    .select("_id title coverImageKey slug")
    .sort({ createdAt: -1 })
    .lean();

  const shapedAlbums = albums.map(shapeAlbumResponse);

  // 🎯 SINGLES (songs without album)
  const singlesQuery = {
    artist: artist._id,
    album: null,
    isDeleted: { $ne: true },
  };

  const totalSingles = await Song.countDocuments(singlesQuery);

  const singles = await Song.find(singlesQuery)
    .select("_id title coverImageKey duration accessType createdAt")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const shapedSingles = singles.map(shapeSongResponse);

  return {
    artist: shapeArtistResponse(artist),

    albums: shapedAlbums,

    singles: shapedSingles,

    pagination: {
      singles: {
        total: totalSingles,
        page,
        limit,
        totalPages: Math.ceil(totalSingles / limit),
      },
    },
  };
};


