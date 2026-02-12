import { UnauthorizedError } from "../errors";
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { StatusCodes } from "http-status-codes";
import { shapeSongResponse } from "../dto/artist.dto";


// ==================== Get Artist Dashboard Songs ====================

export const getArtistDashboardSongs = async (req, res) => {
  

  const artistId = req.user.artistId;

  if (!artistId) {
    throw new UnauthorizedError("Artist profile not found");
  }

  // Pagination
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  // Base query
  const query = {
    artist: artistId,
    isDeleted: false,
  };

  // Type filters
  if (req.query.type === "single") {
    query.album = null;
  }

  if (req.query.type === "album") {
    query.album = { $ne: null };
  }

  const [songs, total] = await Promise.all([
    Song.find(query)
      .select(`
        title
        slug
        duration
        genre
        releaseDate
        coverImageKey
        accessType
        albumOnly
        hlsReady
        basePrice
        artist
        album
        createdAt
      `)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Song.countDocuments(query),
  ]);



  res.json({ success: true, data: "hello" });

  
};


export const getArtistDashboardAlbums = async (req, res) => {
  const artistId = req.user.artistId;
 

  if (!artistId) {
    throw new UnauthorizedError("Artist profile not found");
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const query = { artist: artistId };

  const [albums, total] = await Promise.all([
    Album.find(query)
      .select(`
        title
        coverImage
        releaseDate
        accessType
        basePrice
        isPublished
        createdAt
      `)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Album.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: albums,
    meta: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  });
};


export const getArtistDashboardStats = async (req, res) => {

  const artistId = req.user.artistId;

  if (!artistId) {
    throw new UnauthorizedError("Artist profile not found");
  }

  const [
    totalSongs,
    totalSingles,
    subscriptionSongs,
    purchaseOnlySongs,

    totalAlbums,
    subscriptionAlbums,
    purchaseOnlyAlbums,
  ] = await Promise.all([
    // SONGS
    Song.countDocuments({ artist: artistId }),
    Song.countDocuments({ artist: artistId, album: null }),
    Song.countDocuments({
      artist: artistId,
      accessType: "subscription",
    }),
    Song.countDocuments({
      artist: artistId,
      accessType: "purchase-only",
    }),

    // ALBUMS
    Album.countDocuments({ artist: artistId }),
    Album.countDocuments({
      artist: artistId,
      accessType: "subscription",
    }),
    Album.countDocuments({
      artist: artistId,
      accessType: "purchase-only",
    }),
  ]);

  const revenueReady =
    subscriptionSongs > 0 ||
    purchaseOnlySongs > 0 ||
    subscriptionAlbums > 0 ||
    purchaseOnlyAlbums > 0;

  res.status(200).json({
    success: true,
    data: {
      songs: {
        total: totalSongs,
        singles: totalSingles,
        subscriptionOnly: subscriptionSongs,
        purchaseOnly: purchaseOnlySongs,
      },
      albums: {
        total: totalAlbums,
        subscriptionOnly: subscriptionAlbums,
        purchaseOnly: purchaseOnlyAlbums,
      },
      revenueReady,
    },
  });
};
