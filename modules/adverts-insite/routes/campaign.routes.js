import { Router } from "express";
import { getCampaign, deleteCampaign, updateCampaign, createCampaign, listMyCampaigns, changeCampaignStatus } from "../controllers/campaign.controller.js";

import { authenticateUser } from "../../../middleware/authenticate.js";

const router = Router();
router.use(authenticateUser);

router.post("/create-campaign", createCampaign);
router.get("/get-campaign", getCampaign);
router.get("/list-my-campaigns", listMyCampaigns);
router.patch("/update-campaign", updateCampaign);
router.delete("/delete-campaign", deleteCampaign);
router.patch("change-campaign-status", changeCampaignStatus);

export default router;