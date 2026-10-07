import { StatusCodes } from "http-status-codes";
import { getOrCreateReferralCodeService, getMyReferralsService, } from "../services/referral.service.js";

/**
 * GET /api/v2/referrals/my-code
 * Fetch or generate the logged-in artist's unique referral code & link
 */
export const getMyReferralCodeController = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userArtistId = req.user.artistId || null;
    const data = await getOrCreateReferralCodeService(userId, userArtistId);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: data.isNew
        ? "Referral code generated successfully."
        : "Referral code retrieved successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v2/referrals/my-referrals
 * Fetch referral statistics and referee progress list for the logged-in artist
 */
export const getMyReferralsController = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userArtistId = req.user.artistId || null;
    const result = await getMyReferralsService(userId, userArtistId);

    return res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
