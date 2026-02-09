import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import mongoose from "mongoose";
import { calculatePrice } from "../utils/pricing/calculatePrice.js";
import { NotFoundError } from "../errors/index.js";
import { hasAccessToSong } from "../utils/accessControl.js";
import { shapeSongResponse } from "../dto/song.dto.js";
import { User } from "../models/User.js";
import { Artist } from "../models/Artist.js";

// import { BadRequestError } from "../errors/index.js";
// import { songDeletionQueue } from "../queue/songDeletionQueue.js";

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


export const createSongService = async ({
  data
}) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const finalPrice = calculatePrice(data);

    const [song] = await Song.create(
      [
        {
          title: data.title,
          artist: data.artist,
          album: data.album || null,
          genre: data.genre,
          duration: data.duration,
          accessType: data.accessType,
          basePrice: finalPrice,
          releaseDate: data.releaseDate,
          coverImageKey: data.coverImageKey || null,
          albumOnly: data.albumOnly || false,
          isrc: data.isrc || null,
          audioKey: data.audioKey,
          convertedPrices: data.convertedPrices || []
        }
      ],
      { session }
    );

    if (data.album) {
      const updatedAlbum = await Album.findByIdAndUpdate(
        data.album,
        { $push: { songs: song._id } },
        { session }
      );

      if (!updatedAlbum) {
        throw new NotFoundError(
          "Album not found while attaching song"
        );
      }
    }

    await session.commitTransaction();
    return song;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};


export const updateSongService = async ({ songId, data, coverImageUrl, audioUrl }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const song = await Song.findById(songId).session(session);
    if (!song) throw new Error("Song not found");

    const oldAlbumId = song.album?.toString();
    const newAlbumId = data.album || null;

    // Update song fields
    song.title = data.title ?? song.title;
    song.artist = data.artist ?? song.artist;
    song.genre = data.genre ?? song.genre;
    song.duration = data.duration ?? song.duration;
    song.price = data.price ?? song.price;
    song.accessType = data.accessType ?? song.accessType;
    song.releaseDate = data.releaseDate ?? song.releaseDate;
    song.album = newAlbumId;

    if (coverImageUrl) song.coverImage = coverImageUrl;
    if (audioUrl) {
      song.audioUrl = audioUrl;
      song.audioKey = audioUrl.split("/").pop().replace(/\.[^/.]+$/, "");
    }

    await song.save({ session });

    // Update album references if changed
    if (oldAlbumId && oldAlbumId !== newAlbumId) {
      await Album.findByIdAndUpdate(oldAlbumId, { $pull: { songs: song._id } }, { session });
    }

    if (newAlbumId && oldAlbumId !== newAlbumId) {
      await Album.findByIdAndUpdate(newAlbumId, { $addToSet: { songs: song._id } }, { session });
    }

    await session.commitTransaction();
    session.endSession();

    return song;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const getAllSongsService = async ({
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


export const getAllSinglesService = async ({
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

export const getSongByIdService = async ({
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

export const getSongsMatchingUserGenresService = async ({
  userId,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  /* -------------------- Fetch user preferences -------------------- */
  const user = await User.findById(userId)
    .select("preferredGenres")
    .lean();

  if (!user) {
    throw new NotFoundError("User not found");
  }

  /* -------------------- Normalize genres -------------------- */
  const genreSet = new Set();

  if (Array.isArray(user.preferredGenres)) {
    user.preferredGenres.forEach((g) => {
      if (typeof g === "string" && g.trim()) {
        genreSet.add(g.trim());
      }
    });
  }

  const genreArray = [...genreSet];

  if (genreArray.length === 0) {
    return {
      matchingGenres: [],
      songs: [],
      total: 0
    };
  }

  /* -------------------- Fetch matching songs -------------------- */
  const [total, songs] = await Promise.all([
    Song.countDocuments({ genre: { $in: genreArray } }),
    Song.find({ genre: { $in: genreArray } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  /* -------------------- Access + DTO -------------------- */
  const shapedSongs = await shapeSongsWithAccess({songs, user});

  return {
    matchingGenres: genreArray,
    songs: shapedSongs,
    total
  };
};

export const getSongsByGenreService = async ({
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

export const getSongsByArtistService = async ({
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

export const getSinglesByArtistService = async ({
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

export const getSongsByAlbumService = async ({
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

export const getPurchasedSongsService = async ({
  userId,
  user,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  /* -------------------- Fetch purchased song IDs -------------------- */
  const userDoc = await User.findById(userId)
    .select("purchasedSongs")
    .lean();

  if (!userDoc) {
    throw new NotFoundError("User not found");
  }

  if (!userDoc.purchasedSongs?.length) {
    return {
      songs: [],
      total: 0
    };
  }

  /* -------------------- Fetch songs -------------------- */
  const query = { _id: { $in: userDoc.purchasedSongs } };

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
    songs: shapedSongs,
    total
  };
};

export const getPremiumSongsService = async ({
  user,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  const query = { accessType: "purchase-only" };

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  const shapedSongs = await shapeSongsWithAccess({songs, user});

  return {
    songs: shapedSongs,
    total
  };
};

export const getLikedSongsService = async ({
  userId,
  user,
  page,
  limit
}) => {
  const skip = (page - 1) * limit;

  /* -------------------- Fetch liked song IDs -------------------- */
  const userDoc = await User.findById(userId)
    .select("likedsong")
    .lean();

  if (!userDoc) {
    throw new NotFoundError("User not found");
  }

  if (!userDoc.likedsong?.length) {
    return {
      songs: [],
      total: 0
    };
  }

  /* -------------------- Query songs properly -------------------- */
  const query = { _id: { $in: userDoc.likedsong } };

  const [total, songs] = await Promise.all([
    Song.countDocuments(query),
    Song.find(query)
      .sort({ releaseDate: -1 }) // consistent ordering
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .populate("album", "title slug")
      .lean()
  ]);

  /* -------------------- Access + DTO -------------------- */
  const shapedSongs = await shapeSongsWithAccess({songs, user});

  return {
    songs: shapedSongs,
    total
  };
};






// export const deleteSong = async (songId) => {
//   if (!mongoose.Types.ObjectId.isValid(songId)) {
//     throw new Error("Invalid song ID");
//   }

//   const song = await Song.findById(songId);
//   if (!song) throw new Error("Song not found");

//   // Remove song from album if applicable
//   if (song.album) {
//     await Album.findByIdAndUpdate(song.album, { $pull: { songs: song._id } });
//   }

//   // Enqueue S3 deletion
//   await songDeletionQueue.add("deleteSongFiles", {
//     audioUrl: song.audioUrl,
//     coverImage: song.coverImage,
//   });

//   // Delete song from DB
//   await song.deleteOne();

//   return { message: "Song deleted successfully" };
// };