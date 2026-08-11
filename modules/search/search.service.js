import { Artist } from "../models/Artist.js";
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { shapeSongResponse } from "../../dto/song.dto.js";
import { shapeArtistResponse } from "../../dto/artist.dto.js";
import { shapeAlbumResponse } from "../../dto/album.dto.js";
import { hasAccessToSong } from "../../utils/accessControl.js";
import { BadRequestError } from "../../errors/index.js";

const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildRegex = (q) => new RegExp(escapeRegex(q), "i");


export const getQuery = (req) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) throw new BadRequestError("Query parameter 'q' is required.");
  return q;
};

export const getPagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  return { page, limit };
};


// ---------------- UNIFIED SEARCH ----------------
export const unifiedSearchService = async (query) => {
  const regex = buildRegex(query);

  const artistLimit = 3;
  const songLimit = 5;
  const albumLimit = 3;

  const [artists, songs, albums] = await Promise.all([
    Artist.find({ name: regex }).limit(artistLimit).lean(),

    Song.find({ title: regex })
      .limit(songLimit)
      .populate("artist", "name slug")
      .populate({
        path: "album",
        select: "title slug",
        populate: { path: "artist", select: "name slug" },
      })
      .lean(),

    Album.find({ title: regex })
      .limit(albumLimit)
      .populate("artist", "name slug")
      .lean(),
  ]);

  const [shapedArtists, shapedSongs, shapedAlbums] = await Promise.all([
    Promise.all(artists.map(shapeArtistResponse)),
    Promise.all(songs.map(shapeSongResponse)),
    Promise.all(albums.map(shapeAlbumResponse)),
  ]);

  return {
    artists: shapedArtists,
    songs: shapedSongs,
    albums: shapedAlbums,
  };
};


// ---------------- SONG SEARCH ----------------
export const searchSongsService = async ({ query, page, limit, user }) => {
  const regex = buildRegex(query);
  const skip = (page - 1) * limit;

  const [songs, total] = await Promise.all([
    Song.find({ title: regex })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean(),

    Song.countDocuments({ title: regex }),
  ]);

  const shapedSongs = await Promise.all(
    songs.map(async (song) => {
      const hasAccess = await hasAccessToSong(user, song);
      return shapeSongResponse(song, hasAccess);
    })
  );

  return {
    results: shapedSongs,
    total,
    pages: Math.ceil(total / limit),
  };
};


// ---------------- ARTIST SEARCH ----------------
export const searchArtistsService = async ({ query, page, limit }) => {
  const regex = buildRegex(query);
  const skip = (page - 1) * limit;

  const [artists, total] = await Promise.all([
    Artist.find({ name: regex }).skip(skip).limit(limit).lean(),
    Artist.countDocuments({ name: regex }),
  ]);

  const results = await Promise.all(
    artists.map(shapeArtistResponse)
  );

  return {
    results,
    total,
    pages: Math.ceil(total / limit),
  };
};



// ---------------- ALBUM SEARCH ----------------
export const searchAlbumsService = async ({ query, page, limit }) => {
  const regex = buildRegex(query);
  const skip = (page - 1) * limit;

  const [albums, total] = await Promise.all([
    Album.find({ title: regex })
      .populate("artist", "name slug")
      .populate("songs", "title duration coverImage")
      .skip(skip)
      .limit(limit)
      .lean(),

    Album.countDocuments({ title: regex }),
  ]);

  const results = await Promise.all(albums.map(shapeAlbumResponse));

  return {
    results,
    total,
    pages: Math.ceil(total / limit),
  };
};