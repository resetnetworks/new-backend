import { Artist } from "../models/Artist.js";
import { isAdmin } from "../utils/authHelper.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthorizedError } from "../errors/index.js";
import { cycleToInterval } from "../utils/cycleToInterval.js";
import {
  updateArtistProfileService,
  getAllArtistsService,
  getArtistByIdService,
  getArtistProfileService,
  getAllArtistsWithoutPaginationService,
} from "../services/index.js";
import { shapeArtistResponse } from "../dto/artist.dto.js";
import { getCached, setCached } from "../utils/redisClient.js";
import mongoose from "mongoose";
import { NotFoundError, ForbiddenError } from "../errors/index.js";
import logger from "../utils/logger.js";
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";


export const updateArtistProfile = async (req, res) => {
  const artistId = req.user.artistId;
  const userId = req.user._id;

  logger.info("Update artist profile", { artistId, userId });

  const updatedArtist = await updateArtistProfileService({
    artistId,
    userId,
    payload: req.body,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: shapeArtistResponse(updatedArtist),
  });
};

export const deleteArtist = async (req, res) => {
  if (!isAdmin(req.user)) {
    throw new UnauthorizedError("Access denied. Admins only.");
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new BadRequestError("Invalid artist ID.");
  }

  // Hard delete (if you want cascade cleanup)
  const artist = await Artist.findByIdAndDelete(id);
  if (!artist) {
    throw new NotFoundError("Artist not found.");
  }

  // TODO: Optional cascade cleanup
  // await Song.deleteMany({ artist: id });
  // await Album.deleteMany({ artist: id });
  // await Subscription.deleteMany({ artist: id });
  // await Transaction.updateMany({ artist: id }, { status: "cancelled" });

  // TODO: Audit log (recommended for destructive ops)
  // await AuditLog.create({
  //   action: "delete_artist",
  //   actor: req.user._id,
  //   artistId: id,
  //   timestamp: new Date(),
  // });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Artist deleted successfully",
    artistId: id,
  });
};

export const getAllArtistsController = async (req, res) => {
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
  const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;

  const cacheKey = `artists:list:page=${page}:limit=${limit}`;

  logger.info("Get all artists", { page, limit });

  const cached = await getCached(cacheKey);
  if (cached) {
    return res.status(StatusCodes.OK).json(cached);
  }

  const { artists, total } = await getAllArtistsService({ page, limit });

  const response = {
    success: true,
    data: artists.map(shapeArtistResponse),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };


  await setCached(cacheKey, response, 600); // 10 min

  res.status(StatusCodes.OK).json(response);
};

export const getArtistById = async (req, res) => {
  const identifier = req.params.id;

  const cacheKey = `artist:detail:${identifier}`;

  logger.info("Get artist by identifier", { identifier });

  // 1. Cache first
  const cached = await getCached(cacheKey);
  if (cached) {
    return res.status(StatusCodes.OK).json(cached);
  }

  // 2. Service
  const artist = await getArtistByIdService(identifier);

  const response = {
    success: true,
    data: shapeArtistResponse(artist),
  };

  // 3. Cache (10 min)
  await setCached(cacheKey, response, 600);

  res.status(StatusCodes.OK).json(response);
};

export const getArtistProfile = async (req, res) => {
  const artistId = req.user.artistId;
  const userId = req.user._id;

  logger.info("Get artist profile", { artistId, userId });

  const artist = await getArtistProfileService(artistId, userId);

  res.status(StatusCodes.OK).json({
    success: true,
    data: shapeArtistResponse(artist),
  });
};

export const getAllArtistsWithoutPagination = async (req, res) => {
  logger.info("Get all artists without pagination");

  const artists = await getAllArtistsWithoutPaginationService();

  res.status(StatusCodes.OK).json({
    success: true,
    data: artists.map(shapeArtistResponse),
  });
};