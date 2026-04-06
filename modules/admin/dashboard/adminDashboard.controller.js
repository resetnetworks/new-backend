import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../../../errors/index.js";
import {
  fetchArtistTransactions,
  fetchPurchasedItemsByArtist,
  fetchSubscriberStats,
  fetchArtistRevenueSummary,
} from "./adminDashboard.service.js";


// ✅ 1. Get all transactions for a specific artist (with optional filters)
export const getAllTransactionsByArtist = async (req, res) => {
  const { artistId, itemType, status, startDate, endDate } = req.query;
  if (!artistId) throw new BadRequestError("artistId is required");

  const transactions = await fetchArtistTransactions({
    artistId,
    itemType,
    status,
    startDate,
    endDate,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    count: transactions.length,
    transactions,
  });
};


// ✅ 2. Get all purchased songs for an artist
export const getPurchasedSongsByArtist = async (req, res) => {
  const { artistId } = req.params;
  if (!artistId) throw new BadRequestError("artistId is required");

  const songs = await fetchPurchasedItemsByArtist(artistId, "song");

  res.status(StatusCodes.OK).json({
    success: true,
    count: songs.length,
    songs,
  });
};


// ✅ 3. Get all purchased albums for an artist
export const getPurchasedAlbumsByArtist = async (req, res) => {
  const { artistId } = req.params;
  if (!artistId) throw new BadRequestError("artistId is required");

  const albums = await fetchPurchasedItemsByArtist(artistId, "album");

  res.status(StatusCodes.OK).json({
    success: true,
    count: albums.length,
    albums,
  });
};


export const getSubscriberCount = async (req, res) => {
  const { artistId } = req.params;
  if (!artistId) throw new BadRequestError("artistId is required");

  const stats = await fetchSubscriberStats(artistId);

  res.status(StatusCodes.OK).json({ success: true, ...stats });
};

export const getArtistRevenueSummary = async (req, res) => {
  const { artistId } = req.params;
  if (!artistId) throw new BadRequestError("artistId is required");

  const revenue = await fetchArtistRevenueSummary(artistId);

  res.status(StatusCodes.OK).json({
    success: true,
    artistId,
    revenue,
  });
};