import { Artist } from "../models/Artist.js";
import { shapeArtistResponse } from "../dto/artist.dto.js";
import { createSubscriptionPlans, updateSubscriptionPlans} from "./planService.js";
import mongoose from "mongoose";
import {Song} from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { convertCurrencies } from "../utils/convertCurrencies.js";
export const createArtistService = async ({ name, bio, location, imageUrl, basePrice, cycle, createdBy }) => {
  // Initialize artist object but do not save yet
  const artist = new Artist({ name, bio, location, image: imageUrl, subscriptionPlans: [], createdBy });
  // const basePrice = { currency: "USD", amount: 10 }; // default base price
  const subscriptionPrice = basePrice.amount || 0;
  // If subscription exists, create plans
  if (subscriptionPrice && subscriptionPrice > 0) {
    const intervals = cycle; // cycleToInterval already called in controller
      const convertedPrices = await convertCurrencies(basePrice.currency, basePrice.amount);
    console.log("Converted Prices:", convertedPrices);
    const plans = await createSubscriptionPlans(name, basePrice, cycle, convertedPrices);
    artist.subscriptionPlans.push({
      cycle: intervals.cycleLabel,
      basePrice,
      stripePriceId: plans.stripePriceId,
      razorpayPlanId: plans.razorpayPlanId,
      paypalPlans: plans.paypalPlans,
      convertedPrices
    });
  }
  // Save artist once
  await artist.save();
  return shapeArtistResponse(artist.toObject());
};
/**
 * Artist self-service profile update
 */
export const updateArtistProfileService = async ({
  artistId,
  userId,
  payload,
}) => {
  if (!mongoose.Types.ObjectId.isValid(artistId)) {
    throw new BadRequestError("Invalid artist ID");
  }

  const artist = await Artist.findOne({
    _id: artistId,
    createdBy: userId,
    isDeleted: { $ne: true },
  });

  if (!artist) {
    // do NOT leak ownership info
    throw new NotFoundError("Artist profile not found");
  }

  // Business rule: lock name after monetization
  if (
    payload.name &&
    payload.name !== artist.name &&
    artist.monetizationStatus === "active"
  ) {
    throw new BadRequestError(
      "Artist name cannot be changed after monetization is active"
    );
  }

  const ALLOWED_FIELDS = [
    "name",
    "bio",
    "location",
    "country",
    "socials",
    "profileImageKey",
    "coverImageKey",
  ];

  for (const field of ALLOWED_FIELDS) {
    if (payload[field] !== undefined) {
      artist[field] = payload[field];
    }
  }

  await artist.save();

  return artist.toObject();
};
export const getAllArtistsService = async ({ page, limit }) => {
  const skip = (page - 1) * limit;

  const matchStage = {
    isDeleted: { $ne: true },
    approvalStatus: "approved",
    isMonetizationComplete: true,
  };

  const artists = await Artist.aggregate([
    { $match: matchStage },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },

    // Song count
    {
      $lookup: {
        from: "songs",
        localField: "_id",
        foreignField: "artist",
        pipeline: [{ $match: { isDeleted: { $ne: true } } }],
        as: "songs",
      },
    },

    // Album count
    {
      $lookup: {
        from: "albums",
        localField: "_id",
        foreignField: "artist",
        pipeline: [{ $match: { isDeleted: { $ne: true } } }],
        as: "albums",
      },
    },

    {
      $project: {
        _id: 1,
        name: 1,
        slug: 1,
        bio: 1,
        location: 1,
        country: 1,
        socials: 1,
        subscriptionPlans: 1,

        profileImageKey: 1,
        coverImageKey: 1,

      
        isMonetizationComplete: 1,

        songCount: { $size: "$songs" },
        albumCount: { $size: "$albums" },

        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  const total = await Artist.countDocuments(matchStage);

  return { artists, total };
};
/**
 * Fetch artist by _id or slug with song/album counts
 */
export const getArtistByIdService = async (identifier) => {
  const query = mongoose.Types.ObjectId.isValid(identifier)
    ? { _id: identifier }
    : { slug: identifier };

  const artist = await Artist.findOne({
    ...query,
    isDeleted: { $ne: true },
    approvalStatus: "approved",
  }).lean();

  if (!artist) {
    throw new NotFoundError("Artist not found");
  }

  return artist;
};

export const getArtistProfileService = async (artistId, userId) => {
  if (!artistId || !mongoose.Types.ObjectId.isValid(artistId)) {
    throw new BadRequestError("Artist profile not linked to user");
  }

  const artist = await Artist.findOne({
    _id: artistId,
    createdBy: userId,
    isDeleted: { $ne: true },
  }).lean();

  if (!artist) {
    throw new NotFoundError("Artist profile not found");
  }

  return artist;
};

export const getAllArtistsWithoutPaginationService = async () => {
  return Artist.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        approvalStatus: "approved",
      },
    },

    { $sort: { createdAt: -1 } },

    // Song count
    {
      $lookup: {
        from: "songs",
        localField: "_id",
        foreignField: "artist",
        pipeline: [{ $match: { isDeleted: { $ne: true } } }],
        as: "songs",
      },
    },

    // Album count
    {
      $lookup: {
        from: "albums",
        localField: "_id",
        foreignField: "artist",
        pipeline: [{ $match: { isDeleted: { $ne: true } } }],
        as: "albums",
      },
    },

    {
      $project: {
        _id: 1,
        name: 1,
        slug: 1,
        bio: 1,
        location: 1,
        country: 1,
        socials: 1,

        profileImageKey: 1,
        coverImageKey: 1,

        monetizationStatus: 1,
        isMonetizationComplete: 1,
        subscriptionPlans: 1,

        songCount: { $size: "$songs" },
        albumCount: { $size: "$albums" },

        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
};













