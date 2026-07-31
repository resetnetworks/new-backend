import { 
  createCampaignService, 
  getCampaignService, 
  listMyCampaignsService, 
  updateCampaignService, 
  changeCampaignStatusService, 
  deleteCampaignService 
} from "../services/campaign.service.js";

//. Campaign APIs ⭐⭐⭐
// - Create Campaign
// - Get Campaign
// - List My Campaigns
// - status update - "draft", "scheduled", "active", "paused", "completed", "ended"
// - update campaign: Increase Budget, Extend Duration and ...
// - delete campaign

export const createCampaign = async (req, res) => {
  try {
    const artistId = req.user?.artistId;
    if (!artistId) return res.status(401).json({ message: "Unauthorized: Artist ID is missing" });

    const { campaignName, promotionType, promotionId, status, budget, placement, endDate } = req.body;

    if (!campaignName || !promotionType || !promotionId || !status || !budget || !placement || !endDate) {
      return res.status(400).json({ message: "All required fields are missing" });
    }

    const campaign = await createCampaignService(artistId, req.body);
    
    return res.status(201).json({ message: "Campaign created successfully", campaign });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

export const getCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;
    if (!campaignId) return res.status(400).json({ message: "Please provide Campaign Id" });

    const campaign = await getCampaignService(campaignId);

    return res.status(200).json({ message: "Campaign", campaign });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

export const listMyCampaigns = async (req, res) => {
  try {
    const artistId = req.user.artistId;
    const allCampaign = await listMyCampaignsService(artistId);

    return res.status(200).json({ message: "All Campaigns", allCampaign });
  } catch (error) {
    if (error.message === "No campaigns found") {
      return res.status(404).json({ message: "No campaigns found" });
    }
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

export const updateCampaign = async (req, res) => {
  try {
    const { campaignId, budget, endDate } = req.body;

    if (!campaignId) {
      return res.status(400).json({ message: "campaignId not found" });
    }

    if (budget === undefined && endDate === undefined) {
      return res.status(400).json({ message: "Please provide either budget or endDate" });
    }

    const campaign = await updateCampaignService(campaignId, budget, endDate);

    return res.status(200).json({
      message: "Campaign updated successfully",
      campaign,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const changeCampaignStatus = async (req, res) => {
  try {
    const { campaignId, status } = req.body;
    if (!campaignId) return res.status(400).json({ message: "campaignId not found" });
    if (!status) return res.status(400).json({ message: "status not found" });

    await changeCampaignStatusService(campaignId, status);
    
    return res.status(200).json({ message: "Campaign status changed successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

export const deleteCampaign = async (req, res) => {
  try {
    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({ message: "campaignId not found" });
    }

    await deleteCampaignService(campaignId);

    return res.status(200).json({ message: "Campaign deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};