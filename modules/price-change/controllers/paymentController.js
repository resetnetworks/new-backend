import { StatusCodes } from "http-status-codes";
import { updateGlobalArtistPricing } from "../services/pricing.service.js";

export const updateGlobalPricing = async (req, res) => {
  try {
    const { subscriptionPrice, cycle } = req.body;
    const artistId = req.user?.artistId || req.user?._id || req.artistId;

    if (!artistId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "No artist profile found" });
    }

    const priceNum = parseFloat(subscriptionPrice);
    if (!subscriptionPrice || isNaN(priceNum) || priceNum <= 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "A valid subscriptionPrice greater than 0 is required" });
    }

    if (!cycle) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "cycle is required" });
    }

    const newPlans = await updateGlobalArtistPricing(artistId, priceNum, cycle);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Global subscription prices updated successfully. Subscribers will be migrated in the background.",
      stripePlans: newPlans.stripePlans
    });

  } catch (error) {
    console.error("Update Global Pricing Error:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message || "Unable to update global pricing",
    });
  }
};
