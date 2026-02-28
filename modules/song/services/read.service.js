import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import mongoose from "mongoose";
import { NotFoundError } from "../errors/index.js";
import { hasAccessToSong } from "../utils/accessControl.js";
import { shapeSongResponse } from "../dto/song.dto.js";
import { Artist } from "../models/Artist.js";


export const shapeSongsWithAccess = async ({
  songs,
  user,
  streamUrlResolver = null,
}) => {
  return Promise.all(
    songs.map(async (song) => {
      const hasAccess = user
        ? await hasAccessToSong(user, song)
        : false;

      const streamUrl = hasAccess && streamUrlResolver
        ? await streamUrlResolver(song)
        : null;

      return shapeSongResponse(song, hasAccess, streamUrl);
    })
  );
};


export const getAllSongs = async ({
  user,
  page,
  limit,
  type,
  artistId
}) => {
  const skip = (page - 1) * limit;

  let query = {};
  let sortOption = { createdAt: -1 };

  switch (type) {
    case "recent":
      sortOption = { createdAt: -1 };
      break;

    case "top":
      sortOption = { playCount: -1 };
      break;

    case "similar":
      if (!artistId) {
        throw new BadRequestError(
          "artistId is required for similar songs"
        );
      }
      query.artist = artistId;
      break;

    case "all":
    default:
      break;
  }

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  const shapedSongs = await Promise.all(
    songs.map(async (song) => {
      const hasAccess = user
        ? await hasAccessToSong(user, song)
        : false;

      return shapeSongResponse(song, hasAccess);
    })
  );

  return {
    total,
    songs: shapedSongs
  };
};

export const getAllSingles= async ({
  user,
  page,
  limit,
  type,
  artistId
}) => {
  const skip = (page - 1) * limit;

  // Singles = no album
  const query = { album: null };
  let sortOption = { createdAt: -1 };

  switch (type) {
    case "recent":
      sortOption = { createdAt: -1 };
      break;

    case "top":
      sortOption = { playCount: -1 };
      break;

    case "similar":
      if (!artistId) {
        throw new BadRequestError(
          "artistId is required for similar songs"
        );
      }
      query.artist = artistId;
      break;

    case "all":
    default:
      break;
  }

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug") // will be null for singles
      .lean()
  ]);

  const shapedSongs = await Promise.all(
    songs.map(async (song) => {
      const hasAccess = user
        ? await hasAccessToSong(user, song)
        : false;

      return shapeSongResponse(song, hasAccess);
    })
  );

  return {
    total,
    songs: shapedSongs
  };
};

export const getSongById = async ({
  identifier,
  user
}) => {
  const isObjectId = mongoose.Types.ObjectId.isValid(identifier);

  const song = await Song.findOne(
    isObjectId ? { _id: identifier } : { slug: identifier }
  )
    .populate("artist", "name slug")
    .populate("album", "title slug")
    .lean();

  if (!song) {
    throw new NotFoundError("Song not found");
  }

  const hasAccess = user
    ? await hasAccessToSong(user, song)
    : false;

  return {
    ...song,
    hasAccess
  };
};

export const getSongsByGenre = async ({
  user,
  genre,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  // Case-insensitive genre match
  const query = genre
    ? { genre: { $regex: new RegExp(`^${genre}$`, "i") } }
    : {};

    
  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort({ releaseDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  const shapedSongs = await shapeSongsWithAccess({songs, user});
  

  return {
    total,
    songs: shapedSongs
  };
};

export const getSongsByArtist = async ({
  artistIdentifier,
  user,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  /* -------------------- Resolve artist -------------------- */
  const artistQuery = mongoose.Types.ObjectId.isValid(artistIdentifier)
    ? { _id: artistIdentifier }
    : { slug: artistIdentifier };

  const artist = await Artist.findOne(artistQuery)
    .select("_id name slug image")
    .lean();

  if (!artist) {
    throw new NotFoundError("Artist not found");
  }

  /* -------------------- Fetch songs -------------------- */
  const query = { artist: artist._id };

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort({ releaseDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  /* -------------------- Access + DTO -------------------- */
  const shapedSongs = await shapeSongsWithAccess({songs, user});

  return {
    artist: {
      id: artist._id,
      name: artist.name,
      slug: artist.slug,
      image: artist.image || null
    },
    songs: shapedSongs,
    total
  };
};

export const getSinglesByArtist= async ({
  artistIdentifier,
  user,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  /* -------------------- Resolve artist -------------------- */
  const artistQuery = mongoose.Types.ObjectId.isValid(artistIdentifier)
    ? { _id: artistIdentifier }
    : { slug: artistIdentifier };

  const artist = await Artist.findOne(artistQuery)
    .select("_id name slug image")
    .lean();

  if (!artist) {
    throw new NotFoundError("Artist not found");
  }

  /* -------------------- Fetch singles -------------------- */
  const query = {
    artist: artist._id,
    album: null
  };

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort({ releaseDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .lean()
  ]);

  /* -------------------- Access + DTO -------------------- */
  const shapedSongs = await shapeSongsWithAccess({songs, user});

  return {
    artist: {
      id: artist._id,
      name: artist.name,
      slug: artist.slug,
      image: artist.image || null
    },
    songs: shapedSongs,
    total
  };
};

export const getSongsByAlbum = async ({
  albumIdentifier,
  user,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  /* -------------------- Resolve album -------------------- */
  const albumQuery = mongoose.Types.ObjectId.isValid(albumIdentifier)
    ? { _id: albumIdentifier }
    : { slug: albumIdentifier };

  const album = await Album.findOne(albumQuery)
    .select("_id title slug coverImage")
    .lean();

  if (!album) {
    throw new NotFoundError("Album not found");
  }

  /* -------------------- Fetch songs -------------------- */
  const query = { album: album._id };

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort({ releaseDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  /* -------------------- Access + DTO -------------------- */
  const shapedSongs = await shapeSongsWithAccess({songs, user});

  return {
    album: {
      id: album._id,
      title: album.title,
      slug: album.slug,
      coverImage: album.coverImage || null
    },
    songs: shapedSongs,
    total
  };
};

