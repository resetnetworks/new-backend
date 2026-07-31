import Campaign from "../models/campaign.model.js";
import Artist from "../../artist/models/artist.model.js";

export const createCampaignService = async (artistId, campaignData) => {
  // 1. Validate Artist
  const artist = await Artist.findById(artistId);
  if (!artist) {
    throw new Error("Artist not found");
  }

  // 2. Prepare Data & Create Campaign
  const newCampaign = new Campaign({
    artistId,
    campaignName: campaignData.campaignName,
    promotionType: campaignData.promotionType,
    promotionId: campaignData.promotionId,
    status: campaignData.status,
    budget: campaignData.budget,
    placement: campaignData.placement,
    spent: 0,
    remainingBudget: campaignData.budget,
    startDate: campaignData.startDate || Date.now(),
    endDate: campaignData.endDate,
  });

  // 3. Save to database
  await newCampaign.save();
  return newCampaign;
};

export const getCampaignService = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId).populate("artistId");
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  return campaign;
};

export const listMyCampaignsService = async (artistId) => {
  const allCampaign = await Campaign.find({ artistId });
  if (allCampaign.length === 0) {
    throw new Error("No campaigns found");
  }
  return allCampaign;
};

export const updateCampaignService = async (campaignId, budget, endDate) => {
  const campaignDetail = await Campaign.findById(campaignId);
  if (!campaignDetail) {
    throw new Error("Campaign not found");
  }

  if (budget !== undefined) {
    campaignDetail.budget = budget;
    campaignDetail.remainingBudget = campaignDetail.budget - campaignDetail.spent;
  }

  if (endDate !== undefined) {
    campaignDetail.endDate = endDate;
  }

  await campaignDetail.save();
  return campaignDetail;
};

export const changeCampaignStatusService = async (campaignId, status) => {
  const campaignDetail = await Campaign.findById(campaignId);
  if (!campaignDetail) {
    throw new Error("Campaign not found");
  }

  campaignDetail.status = status;
  await campaignDetail.save();
  return campaignDetail;
};

export const deleteCampaignService = async (campaignId) => {
  const deletedCampaign = await Campaign.findByIdAndDelete(campaignId);
  if (!deletedCampaign) {
    throw new Error("Campaign not found");
  }
  return deletedCampaign;
};
