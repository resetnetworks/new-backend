import { Song } from "../models/song.model.js";
import { uploadToS3 } from "../utils/s3Uploader.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/Artist.js";
import { Transaction } from "../models/Transaction.js"
import { User } from "../models/User.js";
import { hasAccessToSong } from "../utils/accessControl.js";
import mongoose from "mongoose";
import { BadRequestError, UnauthorizedError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from 'http-status-codes';
import { isAdmin } from "../utils/authHelper.js";
import { shapeSongResponse } from "../dto/song.dto.js";
import { streamSong } from "./streamController.js";
import { convertCurrencies } from "../utils/convertCurrencies.js";
import {
  createSongService,
  updateSongService,
  getAllSongsService,
  getAllSinglesService,
  getSongByIdService,
  getSongsMatchingUserGenresService,
  getSongsByGenreService,
  getSongsByArtistService,
  getSinglesByArtistService,
  getSongsByAlbumService,
  getPurchasedSongsService,
  getPremiumSongsService,
  getLikedSongsService
} from "../services/index.js";



const ALLOWED_ACCESS_TYPES = ["free", "subscription", "purchase-only"];

const parseJSONSafe = (value, fieldName) => {
  if (!value) return null;

  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      // 🔥 IMPORTANT: trim + handle double-stringify
      let cleaned = value.trim();
      let parsed = JSON.parse(cleaned);

      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed.trim());
      }

      return parsed;
    } catch (err) {
      console.error(`Invalid ${fieldName}:`, JSON.stringify(value));
      throw new BadRequestError(`${fieldName} must be valid JSON`);
    }
  }

  throw new BadRequestError(`${fieldName} has invalid type`);
};

const extractFileId = (key) => {
  if (!key) return null;

  // Remove leading folder if present
  const normalized = key.replace(/^songs\//, "");

  // Split artistId / fileName
  const parts = normalized.split("/");
  if (parts.length !== 2) return null;

  // Remove extension (.wav, .mp3, .aac, etc.)
  return parts[1].replace(/\.[^.]+$/, "");
};

export const extractSongIdFromKey = (key) => {
  if (!key || typeof key !== "string") return null;

  return key
    .replace(/^songs\//, "")     // remove `songs/` prefix
    .replace(/\.[^/.]+$/, "");   // remove file extension
};




// ===================================================================
// @desc    Create a new song (Artist only)
// @route   POST /api/songs
// @access  Artist
// ===================================================================
export const createSongController = async (req, res) => {
  /* -------------------- Auth / Artist check -------------------- */
  const artistId = req.user?.artistId;
  if (!artistId) {
    throw new ForbiddenError("Artist profile not linked to user");
  }

  /* -------------------- Input extraction -------------------- */
  const {
    title,
    genre,
    duration,
    basePrice,
    accessType = "subscription",
    releaseDate,
    albumOnly,
    album,
    isrc,
    audioKey,
    coverImageKey
  } = req.body;

  /* -------------------- Basic validation -------------------- */
  if (!title || !duration) {
    throw new BadRequestError("Title and duration are required");
  }

  if (!audioKey || typeof audioKey !== "string") {
    throw new BadRequestError("audioKey is required");
  }

  if (!audioKey.startsWith("songs/")) {
    throw new BadRequestError("Invalid audio key");
  }

  if (coverImageKey && !coverImageKey.startsWith("covers/")) {
    throw new BadRequestError("Invalid cover image key");
  }

  if (!ALLOWED_ACCESS_TYPES.includes(accessType)) {
    throw new BadRequestError("Invalid access type");
  }

  /* -------------------- Album-only parsing -------------------- */
  const albumOnlyBool =
    albumOnly === undefined
      ? false
      : typeof albumOnly === "string"
      ? albumOnly === "true"
      : Boolean(albumOnly);

  if (albumOnlyBool && !album) {
    throw new BadRequestError("Album-only songs must belong to an album");
  }

  /* -------------------- Album validation -------------------- */
  const albumDoc = album
    ? await Album.findOne({ _id: album, artist: artistId })
        .select("coverImageKey genre accessType")
        .lean()
    : null;

  if (album && !albumDoc) {
    throw new ForbiddenError(
      "Album not found or does not belong to you"
    );
  }

  if (albumDoc && albumDoc.accessType !== accessType) {
    throw new BadRequestError(
      "Song access type must match album access type"
    );
  }

  /* -------------------- Genre resolution -------------------- */
  const genreArray = albumOnlyBool
    ? albumDoc?.genre || []
    : genre
    ? Array.isArray(genre)
      ? genre
      : genre.split(",").map((g) => g.trim())
    : [];

  /* -------------------- Pricing rules -------------------- */
  const isPurchaseOnly = accessType === "purchase-only";
  const isSinglePurchaseSong = isPurchaseOnly && !albumOnlyBool;

  if (isSinglePurchaseSong && !basePrice) {
    throw new BadRequestError(
      "Price is required for purchase-only single songs"
    );
  }

  if (basePrice && (!isPurchaseOnly || albumOnlyBool)) {
    throw new BadRequestError(
      "Price can only be set for purchase-only single songs"
    );
  }

  const parsedBasePrice = basePrice
    ? parseJSONSafe(basePrice, "basePrice")
    : null;

  if (parsedBasePrice) {
    if (
      typeof parsedBasePrice.amount !== "number" ||
      parsedBasePrice.amount <= 0 ||
      !parsedBasePrice.currency
    ) {
      throw new BadRequestError("Invalid price format");
    }
  }

  /* -------------------- S3 verification -------------------- */
  if (process.env.VERIFY_S3_UPLOAD === "true") {
    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: audioKey
        })
      );

      if (!albumOnlyBool && coverImageKey) {
        await s3.send(
          new HeadObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: coverImageKey
          })
        );
      }
    } catch {
      throw new BadRequestError(
        "Uploaded media not found in storage"
      );
    }
  }

  /* -------------------- URL construction -------------------- */
  

  const finalCoverImageKey = albumOnlyBool
    ? albumDoc?.coverImageKey || null
    : coverImageKey || albumDoc?.coverImageKey || null;


  /* -------------------- Currency conversion -------------------- */
  const convertedPrices = isSinglePurchaseSong
    ? await convertCurrencies(
        parsedBasePrice.currency,
        parsedBasePrice.amount
      )
    : [];

  /* -------------------- Persistence -------------------- */
  const song = await createSongService({
    data: {
      title,
      artist: artistId,
      genre: genreArray,
      duration,
      accessType,
      basePrice: parsedBasePrice
        ? {
            amount: Number(parsedBasePrice.amount),
            currency: parsedBasePrice.currency
          }
        : null,
      releaseDate,
      albumOnly: albumOnlyBool,
      album,
      convertedPrices,
      isrc,
      coverImageKey: finalCoverImageKey || null,
      audioKey,
    },
    
   
  });

  /* -------------------- Business event log -------------------- */
  req.log.info(
    {
      event: "song.created",
      songId: song._id,
      artistId,
      albumId: song.album || null,
      accessType: song.accessType
    },
    "Song created"
  );

  /* -------------------- Response -------------------- */
  res.status(StatusCodes.CREATED).json({
    success: true,
    song: shapeSongResponse(song, false)
  });
};






// ===================================================================
// @desc    Update an existing song (Admin only)
// @route   PUT /api/songs/:id
// @access  Admin
// ===================================================================
export const updateSongController = async (req, res) => {
  /* -------------------- Auth / Artist check -------------------- */
  const artistId = req.user?.artistId;
  if (!artistId) {
    throw new ForbiddenError("Artist profile not linked to user");
  }

  /* -------------------- Call service -------------------- */
  const song = await updateSongService({
    songId: req.params.id,
    artistId,
    payload: req.body
  });

  /* -------------------- Business event log -------------------- */
  req.log.info(
    {
      event: "song.updated",
      songId: song._id,
      artistId,
      accessType: song.accessType,
      albumId: song.album || null
    },
    "Song updated"
  );

  /* -------------------- Response -------------------- */
  res.status(StatusCodes.OK).json({
    success: true,
    song: shapeSongResponse(song, false)
  });
};




// ===================================================================
// @desc    Delete a song by ID (Admin only)
// @route   DELETE /api/songs/:id
// @access  Admin
// ===================================================================
// export const deleteSong = async (req, res) => {
//   // 🔐 Authorization check
//   if (!isAdmin(req.user)) {
//     throw new UnauthorizedError("Access denied. Admins only.");
//   }

//   const { id } = req.params;

//   // ✅ Validate ObjectId format
//   if (!mongoose.Types.ObjectId.isValid(id)) {
//     throw new BadRequestError("Invalid song ID");
//   }

//   // 🔍 Find the song
//   const song = await Song.findById(id);
//   if (!song) {
//     throw new NotFoundError("Song not found");
//   }

//   // 🧹 Remove song reference from album if present
//   if (song.album) {
//     await Album.findByIdAndUpdate(song.album, {
//       $pull: { songs: song._id },
//     });
//   }

//   // ☁️ Optionally: delete files from S3
//   // await deleteFromS3(song.audioUrl);
//   // if (song.coverImage) await deleteFromS3(song.coverImage);

//   // 🗑️ Delete the song
//   await song.deleteOne();

//   // ✅ Response
//   res.status(StatusCodes.OK).json({
//     success: true,
//     message: "Song deleted successfully",
//   });
// };

export const deleteSong = async (req, res) => {
  const { songId } = req.params;

  const song = await Song.findById(songId);
  if (!song) throw new NotFoundError("Song not found");

  // ownership check
  if (!req.user.isAdmin && song.artist.toString() !== req.user.artistId) {
    throw new ForbiddenError("Not allowed");
  }

  if (song.isDeleted) {
    return res.json({ success: true, message: "Song already deleted" });
  }

  song.isDeleted = true;
  song.deletedAt = new Date();
  await song.save();

  res.json({
    success: true,
    message: "Song soft deleted successfully"
  });
};

export const restoreSongController = async (req, res) => {
  const song = await Song.findById(req.params.songId);
  if (!song) throw new NotFoundError("Song not found");

  song.isDeleted = false;
  song.deletedAt = null;
  await song.save();

  res.json({
    success: true,
    message: "Song restored successfully"
  });
};




// ===================================================================
// @desc    Get all songs with filtering, sorting, and pagination
// @route   GET /api/songs
// @access  Authenticated users
// ===================================================================
export const getAllSongsController = async (req, res) => {
  const user = req.user;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const type = req.query.type || "all";
  const artistId = req.query.artistId || null;

  const { songs, total } = await getAllSongsService({
    user,
    page,
    limit,
    type,
    artistId
  });

  // 📘 read event (NOT per-song)
  req.log.info(
    {
      event: "songs.listed",
      type,
      page,
      limit,
      artistId
    },
    "Songs listed"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    type,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalSongs: total,
    songs
  });
};



export const getAllSinglesController = async (req, res) => {
  const user = req.user;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const type = req.query.type || "all";
  const artistId = req.query.artistId || null;

  const { songs, total } = await getAllSinglesService({
    user,
    page,
    limit,
    type,
    artistId
  });

  // 📘 read event (list-level, not per song)
  req.log.info(
    {
      event: "songs.singles.listed",
      type,
      page,
      limit,
      artistId
    },
    "Singles listed"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    type,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
    totalSongs: total,
    songs
  });
};




// ===================================================================
// @desc    Get a single song by ID or slug
// @route   GET /api/songs/:id
// @access  Authenticated users
// ===================================================================
export const getSongByIdController = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const song = await getSongByIdService({
    identifier: id,
    user
  });

  // 📘 read event
  req.log.info(
    {
      event: "song.viewed",
      songId: song._id,
      identifier: id
    },
    "Song viewed"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    song: shapeSongResponse(song, song.hasAccess)
  });
};




// ===================================================================
// @desc    Get songs matching user’s preferred and purchased genres (paginated)
// @route   GET /api/songs/matching-genres?page=1&limit=20
// @access  Authenticated users
// ===================================================================
export const getSongsMatchingUserGenresController = async (req, res) => {
  const userId = req.user?._id;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const result = await getSongsMatchingUserGenresService({
    userId,
    page,
    limit
  });

  // 📘 analytics / read event
  req.log.info(
    {
      event: "songs.recommended.by_genre",
      userId,
      page,
      limit,
      matchedGenres: result.matchingGenres.length
    },
    "Genre-based recommendations fetched"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    matchingGenres: result.matchingGenres,
    songs: result.songs,
    total: result.total,
    page,
    pages: Math.ceil(result.total / limit)
  });
};


// ===================================================================
// @desc    Get songs by genre with pagination
// @route   GET /api/songs?genre=pop&page=1&limit=20
// @access  Public
// ===================================================================
export const getSongsByGenreController = async (req, res) => {
  const user = req.user;
  const { genre } = req.params;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const { songs, total } = await getSongsByGenreService({
    user,
    genre,
    page,
    limit
  });

  // 📘 analytics / read event
  req.log.info(
    {
      event: "songs.listed.by_genre",
      genre,
      page,
      limit
    },
    "Songs listed by genre"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    genre,
    total,
    page,
    pages: Math.ceil(total / limit),
    songs
  });
};



// ===================================================================
// @desc    Get songs by artist ID or slug, with pagination
// @route   GET /api/songs/by-artist/:artistId?page=1&limit=20
// @access  Public
// ===================================================================
export const getSongsByArtistController = async (req, res) => {
  const { artistId } = req.params;
  const user = req.user;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const result = await getSongsByArtistService({
    artistIdentifier: artistId,
    user,
    page,
    limit
  });

  // 📘 analytics / read event
  req.log.info(
    {
      event: "songs.listed.by_artist",
      artistId: result.artist.id,
      page,
      limit
    },
    "Songs listed by artist"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    artist: result.artist,
    songs: result.songs,
    total: result.total,
    page,
    pages: Math.ceil(result.total / limit)
  });
};


export const getSinglesByArtistController = async (req, res) => {
  const { artistId } = req.params;
  const user = req.user;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const result = await getSinglesByArtistService({
    artistIdentifier: artistId,
    user,
    page,
    limit
  });

  // 📘 analytics / read event
  req.log.info(
    {
      event: "songs.singles.listed.by_artist",
      artistId: result.artist.id,
      page,
      limit
    },
    "Artist singles listed"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    artist: result.artist,
    songs: result.songs,
    total: result.total,
    page,
    pages: Math.ceil(result.total / limit)
  });
};


// ===================================================================
// @desc    Get songs by album ID or slug with pagination
// @route   GET /api/songs/by-album/:albumId?page=1&limit=20
// @access  Public
// ===================================================================
export const getSongsByAlbumController = async (req, res) => {
  const { albumId } = req.params;
  const user = req.user;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const result = await getSongsByAlbumService({
    albumIdentifier: albumId,
    user,
    page,
    limit
  });

  // 📘 analytics / read event
  req.log.info(
    {
      event: "songs.listed.by_album",
      albumId: result.album.id,
      page,
      limit
    },
    "Songs listed by album"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    album: result.album,
    songs: result.songs,
    total: result.total,
    page,
    pages: Math.ceil(result.total / limit)
  });
};


// ===================================================================
// @desc    Get all purchased songs for the authenticated user
// @route   GET /api/songs/purchased?page=1&limit=20
// @access  Private
// ===================================================================
export const getPurchasedSongsController = async (req, res) => {
  const user = req.user;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const result = await getPurchasedSongsService({
    userId: user._id,
    user,
    page,
    limit
  });

  // 📘 analytics / read event
  req.log.info(
    {
      event: "songs.listed.purchased",
      userId: user._id,
      page,
      limit
    },
    "Purchased songs listed"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    songs: result.songs,
    total: result.total,
    page,
    pages: Math.ceil(result.total / limit)
  });
};


// ===================================================================
// @desc    Get all premium songs with access control and pagination
// @route   GET /api/songs/premium?page=1&limit=20
// @access  Private (user must be logged in)
// ===================================================================
export const getPremiumSongsController = async (req, res) => {
  const user = req.user;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const result = await getPremiumSongsService({
    user,
    page,
    limit
  });

  // 📘 analytics / read event
  req.log.info(
    {
      event: "songs.listed.purchase_only",
      page,
      limit
    },
    "Purchase-only songs listed"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    songs: result.songs,
    total: result.total,
    page,
    pages: Math.ceil(result.total / limit)
  });
};



// ===================================================================
// @desc    Get paginated liked songs by song IDs
// @route   POST /api/songs/liked
// @access  Private
// ===================================================================
export const getLikedSongsController = async (req, res) => {
  const user = req.user;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);

  const result = await getLikedSongsService({
    userId: user._id,
    user,
    page,
    limit
  });

  // 📘 analytics / read event
  req.log.info(
    {
      event: "songs.listed.liked",
      userId: user._id,
      page,
      limit
    },
    "Liked songs listed"
  );

  res.status(StatusCodes.OK).json({
    success: true,
    songs: result.songs,
    total: result.total,
    page,
    pages: Math.ceil(result.total / limit)
  });
};






