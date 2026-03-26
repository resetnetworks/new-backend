import { Song } from "../models/song.model.js";
import Album from "../models/album.model.js";
import { shapeSongResponse } from "../../dto/song.dto.js";
import { shapeAlbumResponse } from "../../dto/album.dto.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function buildPagination(pageRaw, limitRaw) {
  const page = Math.max(1, Number(pageRaw) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(limitRaw) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

function buildSongQuery({ artistId, type }) {
  const query = {
    artist: artistId,
    isDeleted: false,
  };

  if (type === "single") query.album = null;
  if (type === "album") query.album = { $ne: null };

  return query;
}


async function getSongs({ artistId, page, limit, type }) {
  const { skip, limit: finalLimit, page: finalPage } = buildPagination(page, limit);
  const query = buildSongQuery({ artistId, type });

  const [songs, total] = await Promise.all([
    Song.find(query)
      .select(`
        title slug duration genre releaseDate coverImageKey
        accessType albumOnly hlsReady basePrice artist album createdAt
      `)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(finalLimit)
      .lean(),
    Song.countDocuments(query),
  ]);

  const shapedSongs = songs.map(shapeSongResponse);

  return {
    data: shapedSongs,
    meta: {
      total,
      page: finalPage,
      pages: Math.ceil(total / finalLimit),
    },
  };
}


async function getAlbums({ artistId, page, limit }) {
  const { page: pageNum, limit: limitNum, skip } = buildPagination(page, limit);

  const query = { artist: artistId };

  const [albums, total] = await Promise.all([
    Album.find(query)
      .select(`
        title coverImage releaseDate accessType
        basePrice isPublished createdAt
      `)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Album.countDocuments(query),
  ]);

  const shapedAlbums = albums.map(shapeAlbumResponse);

  return {
    data: shapedAlbums,
    meta: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    },
  };
}


async function getStats({ artistId }) {
  const [
    totalSongs,
    totalSingles,
    subscriptionSongs,
    purchaseOnlySongs,
    totalAlbums,
    subscriptionAlbums,
    purchaseOnlyAlbums,
  ] = await Promise.all([
    Song.countDocuments({ artist: artistId }),
    Song.countDocuments({ artist: artistId, album: null }),
    Song.countDocuments({ artist: artistId, accessType: "subscription" }),
    Song.countDocuments({ artist: artistId, accessType: "purchase-only" }),
    
    Album.countDocuments({ artist: artistId }),
    Album.countDocuments({ artist: artistId, accessType: "subscription" }),
    Album.countDocuments({ artist: artistId, accessType: "purchase-only" }),
  ]);

  const revenueReady =
    subscriptionSongs > 0 ||
    purchaseOnlySongs > 0 ||
    subscriptionAlbums > 0 ||
    purchaseOnlyAlbums > 0;

  return {
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
  };
}

export const artistDashboardService = {
  getSongs,
  getAlbums,
  getStats,
};