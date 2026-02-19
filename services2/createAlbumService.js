import Album from "../models/album.model.js";
import Song from "../../song/models/song.model.js";
import { BadRequestError, NotFoundError } from "../../errors/index.js";
import { convertCurrencies } from "../../utils/currency.js";

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