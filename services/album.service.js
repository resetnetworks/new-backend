import { Album } from "../models/album.model.js";
import { Song } from "../models/song.model.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { convertCurrencies } from "../utils/convertCurrencies.js";
import mongoose from "mongoose";

export const createAlbumService = async ({ artistId, payload }) => {
  const {
    title,
    description = "",
    genre = [],
    releaseDate,
    accessType = "subscription",
    basePrice,
    coverImageKey = null,
    songs,
  } = payload;

  // --- Pricing rules ---
  const isPurchaseOnly = accessType === "purchase-only";

  if (isPurchaseOnly && !basePrice) {
    throw new BadRequestError("Base price is required for purchase-only albums");
  }

  if (!isPurchaseOnly && basePrice) {
    throw new BadRequestError("Pricing not allowed for this access type");
  }

  let convertedPrices = [];

  if (isPurchaseOnly) {
    convertedPrices = await convertCurrencies(
      basePrice.currency,
      basePrice.amount
    );
  }

  // --- Validate songs belong to artist ---
  if (songs?.length) {
    const count = await Song.countDocuments({
      _id: { $in: songs },
      artist: artistId,
      isDeleted: { $ne: true },
    });

    if (count !== songs.length) {
      throw new BadRequestError("One or more songs are invalid");
    }
  }

  // --- Persist ---
  const album = await Album.create({
    title,
    description,
    artist: artistId,
    genre,
    releaseDate,
    accessType,
    basePrice: isPurchaseOnly
      ? {
          amount: Number(basePrice.amount),
          currency: basePrice.currency,
        }
      : null,
    convertedPrices,
    coverImageKey,
    songs,
  });

  return album.toObject();
};

export const updateAlbumService = async ({
  albumId,
  artistId,
  payload,
}) => {
  if (!mongoose.Types.ObjectId.isValid(albumId)) {
    throw new BadRequestError("Invalid album ID");
  }

  const album = await Album.findOne({
    _id: albumId,
    artist: artistId,
    isDeleted: { $ne: true },
  });

  if (!album) {
    throw new NotFoundError("Album not found");
  }

  const {
    title,
    description,
    genre,
    releaseDate,
    accessType,
    basePrice,
    coverImageKey,
    songs,
  } = payload;

  /* ---------- Pricing rules ---------- */
  if (accessType) {
    const isPurchaseOnly = accessType === "purchase-only";

    if (isPurchaseOnly && !basePrice && !album.basePrice) {
      throw new BadRequestError(
        "Base price is required for purchase-only albums"
      );
    }

    if (!isPurchaseOnly && basePrice) {
      throw new BadRequestError(
        "Pricing not allowed for this access type"
      );
    }

    album.accessType = accessType;
  }

  if (basePrice) {
    if (
      typeof basePrice.amount !== "number" ||
      basePrice.amount <= 0 ||
      !basePrice.currency
    ) {
      throw new BadRequestError("Invalid base price");
    }

    album.basePrice = {
      amount: Number(basePrice.amount),
      currency: basePrice.currency,
    };

    album.convertedPrices = await convertCurrencies(
      basePrice.currency,
      basePrice.amount
    );
  }

  /* ---------- Songs validation ---------- */
  if (Array.isArray(songs)) {
    const count = await Song.countDocuments({
      _id: { $in: songs },
      artist: artistId,
      isDeleted: { $ne: true },
    });

    if (count !== songs.length) {
      throw new BadRequestError(
        "One or more songs are invalid or do not belong to the artist"
      );
    }

    album.songs = songs;
  }

  /* ---------- Partial updates ---------- */
  const UPDATABLE_FIELDS = {
    title,
    description,
    genre,
    releaseDate,
    coverImageKey,
  };

  for (const [key, value] of Object.entries(UPDATABLE_FIELDS)) {
    if (value !== undefined) {
      album[key] = value;
    }
  }

  await album.save();
  return album.toObject();
};

export const getAllAlbumsService = async ({ page, limit }) => {
  const skip = (page - 1) * limit;

  const query = {
    isDeleted: { $ne: true },
  };

  const [albums, total] = await Promise.all([
    Album.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("artist", "name slug")
      .lean(),
    Album.countDocuments(query),
  ]);

  return { albums, total };
};

export const getAlbumByIdService = async (identifier, user) => {
  const query = mongoose.Types.ObjectId.isValid(identifier)
    ? { _id: identifier }
    : { slug: identifier };

  const album = await Album.findOne({
    ...query,
    isDeleted: { $ne: true },
  })
    .populate("artist", "name slug profileImageKey")
    .populate(
      "songs",
      "_id title duration accessType artist coverImageKey audioKey"
    )
    .lean();

  if (!album) {
    throw new NotFoundError("Album not found");
  }

  // Enforce song-level access
  const songs = await Promise.all(
    (album.songs || []).map(async (song) => {
      const hasAccess = user
        ? await hasAccessToSong(user, song)
        : false;

      return {
        _id: song._id,
        title: song.title,
        duration: song.duration,
        accessType: song.accessType,
        coverImageKey: song.coverImageKey,
        audioKey: hasAccess ? song.audioKey : null,
      };
    })
  );

  return {
    ...album,
    songs,
  };
};

export const getAllAlbumsWithoutPaginationService = async () => {
  return Album.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
      },
    },

    { $sort: { createdAt: -1 } },

    // Artist info (lightweight)
    {
      $lookup: {
        from: "artists",
        localField: "artist",
        foreignField: "_id",
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              profileImageKey: 1,
            },
          },
        ],
        as: "artist",
      },
    },
    { $unwind: { path: "$artist", preserveNullAndEmptyArrays: true } },

    {
      $project: {
        _id: 1,
        title: 1,
        slug: 1,
        description: 1,
        genre: 1,
        releaseDate: 1,
        accessType: 1,
        basePrice: 1,
        convertedPrices: 1,

        coverImageKey: 1,

        artist: 1,

        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
};

