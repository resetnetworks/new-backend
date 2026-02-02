import { StatusCodes } from "http-status-codes";
import { ArtistBalance } from "../models/ArtistBalance.js";
import { BadRequestError } from "../../../errors/index.js";
import { ArtistLedger } from "../models/ArtistLedger.js";
import { ArtistPayout } from "../models/ArtistPayout.js";


export const getArtistBalance = async (req, res) => {
  const artistId = req.user.artistId;

  const balance = await ArtistBalance.findOne({ artistId }).lean();

  return res.status(StatusCodes.OK).json({
    success: true,
    balance: balance || {
      totalEarned: 0,
      availableBalance: 0,
      totalPaidOut: 0,
      currency: "INR",
    },
  });
};




export const getArtistLedger = async (req, res) => {
  const artistId = req.user.artistId;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const ledger = await ArtistLedger.find({ artistId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return res.status(StatusCodes.OK).json({
    success: true,
    page,
    limit,
    ledger,
  });
};


export const getArtistPayouts = async (req, res) => {
  const artistId = req.user.artistId;

  const payouts = await ArtistPayout.find({ artistId })
    .sort({ createdAt: -1 })
    .lean();

  return res.status(StatusCodes.OK).json({
    success: true,
    payouts,
  });
};