import { StatusCodes } from "http-status-codes";
import { requestArtistPayout } from "../services/artistPayoutService.js";

export const requestPayout = async (req, res) => {
  const artistId = req.user.artistId; // assume artist-auth middleware
  const { amount, paypalEmail } = req.body;

  const payout = await requestArtistPayout({
    artistId,
    amount: Number(amount),
    paypalEmail,
  });

  return res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Payout request created successfully",
    payout,
  });
};
