import { Album } from "../models/album.model.js";

import { Song } from "../models/song.model.js";
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
} from "../errors/index.js";
import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import { Artist } from "../models/Artist.js";
import { shapeAlbumResponse } from "../dto/album.dto.js";
import { hasAccessToSong } from "../utils/accessControl.js";
import { convertCurrencies } from "../utils/convertCurrencies.js";
import { ForbiddenError } from "../errors/index.js";
import * as albumService from "../services/album.service.js";


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


export const createAlbumController = async (req, res) => {
  const artistId = req.user.artistId;

  logger.info("Create album", { artistId });

  const album = await createAlbumService({
    artistId,
    payload: req.body,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    data: shapeAlbumResponse(album),
  });
};


export const updateAlbumController = async (req, res) => {
  const artistId = req.user.artistId;
  const albumId = req.params.id;

  logger.info("Update album", { albumId, artistId });

  const album = await updateAlbumService({
    albumId,
    artistId,
    payload: req.body,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    data: shapeAlbumResponse(album),
  });
};


export const getAllAlbumsController = async (req, res) => {
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
  const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;

  logger.info("Get all albums", { page, limit });

  const { albums, total } = await getAllAlbumsService({ page, limit });

  res.status(StatusCodes.OK).json({
    success: true,
    data: albums.map(shapeAlbumResponse),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};


export const getAlbumByIdController = async (req, res) => {
  const identifier = req.params.id;
  const user = req.user || null;

  logger.info("Get album by identifier", { identifier });

  const album = await getAlbumByIdService(identifier, user);

  res.status(StatusCodes.OK).json({
    success: true,
    data: shapeAlbumResponse(album),
  });
};


export const getAlbumsByArtistController = async (req, res) => {
  const { artistId } = req.params;

  // 🔍 Resolve artist by ID or slug
  const artist = mongoose.Types.ObjectId.isValid(artistId)
    ? await Artist.findById(artistId).lean()
    : await Artist.findOne({ slug: artistId }).lean();

  if (!artist) {
    throw new NotFoundError("Artist not found");
  }

  // 📄 Pagination
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  const [albums, total] = await Promise.all([
    Album.find({ artist: artist._id })
      .sort({ releaseDate: -1 })
      .skip(skip)
      .limit(limit)
      .select("title slug coverImage releaseDate accessType basePrice convertedPrices")
      .lean(),
    Album.countDocuments({ artist: artist._id }),
  ]);
 
  // 🧠 Shape albums for frontend + inject artist info into each album
  const shapedAlbums = albums.map((album) => ({
    ...shapeAlbumResponse(album),
    artist: {
      name: artist.name,
      slug: artist.slug,
      image: artist.image,
    },
  }));

  res.status(StatusCodes.OK).json({
    success: true,
    artist: {
      id: artist._id,
      name: artist.name,
      slug: artist.slug,
      image: artist.image,
      subscriptionPrice: artist.subscriptionPrice,
    },
    albums: shapedAlbums,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};


export const getAllAlbumsWithoutPaginationController = async (req, res) => {
  logger.info("Get all albums without pagination");

  const albums = await getAllAlbumsWithoutPaginationService();

  res.status(StatusCodes.OK).json({
    success: true,
    data: albums.map(shapeAlbumResponse),
    total: albums.length,
  });
};


export const softDeleteAlbumController = async (req, res) => {
  const album = await Album.findById(req.params.albumId);
  if (!album) throw new NotFoundError("Album not found");

  if (!req.user.isAdmin && album.artist.toString() !== req.user.artistId) {
    throw new ForbiddenError("Not allowed");
  }

  album.isDeleted = true;
  album.deletedAt = new Date();
  await album.save();

  res.json({
    success: true,
    message: "Album soft deleted"
  });
};


export const restoreAlbumController = async (req, res) => {
  const album = await Album.findById(req.params.albumId);
  if (!album) throw new NotFoundError("Album not found");

  album.isDeleted = false;
  album.deletedAt = null;
  await album.save();

  res.json({
    success: true,
    message: "Album restored"
  });
};