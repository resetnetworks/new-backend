import { StatusCodes } from "http-status-codes";
import { updateGlobalArtistPricing } from "../services/pricing.service.js";

export const updateGlobalPricing = async (req, res) => {
  try {
    const { subscriptionPrice, cycle } = req.body;
    const artistId = req.user.artistId;

    if (!artistId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "No artist profile found" });
    }
    if (!subscriptionPrice || !cycle) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "subscriptionPrice and cycle are required" });
    }

    const newPlans = await updateGlobalArtistPricing(artistId, subscriptionPrice, cycle);

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
