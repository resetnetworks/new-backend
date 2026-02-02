import { StatusCodes } from "http-status-codes";
import { ArtistPayout } from "../models/ArtistPayout.js";
import { BadRequestError, NotFoundError } from "../../../errors/index.js";

export const getPendingPayouts = async (req, res) => {
  const { status = "requested" } = req.query;

  const payouts = await ArtistPayout.find({ status })
    .populate("artistId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(StatusCodes.OK).json({
    success: true,
    count: payouts.length,
    payouts,
  });
};


export const markPayoutAsPaid = async (req, res) => {
  const { payoutId } = req.params;
  const adminId = req.user._id; // admin user

  const payout = await ArtistPayout.findById(payoutId);

  if (!payout) {
    throw new NotFoundError("Payout request not found");
  }

  if (payout.status === "paid") {
    throw new BadRequestError("Payout already marked as paid");
  }

  payout.status = "paid";
  payout.processedBy = adminId;
  payout.processedAt = new Date();

  await payout.save();

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Payout marked as paid successfully",
    payout,
  });
};