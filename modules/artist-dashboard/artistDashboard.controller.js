import { UnauthorizedError } from "../../errors/index.js";
import { artistDashboardService } from "./artistDashboard.services.js";


// ==================== Get Artist Dashboard Songs ====================
export const getArtistDashboardSongs = async (req, res) => {
  const artistId = req.user.artistId;
  if (!artistId) throw new UnauthorizedError("Artist profile not found");

  const result = await artistDashboardService.getSongs({
    artistId,
    page: req.query.page,
    limit: req.query.limit,
    type: req.query.type,
  });

  res.json({ success: true, ...result });
};


export const getArtistDashboardAlbums = async (req, res) => {
  const artistId = req.user.artistId;
  if (!artistId) throw new UnauthorizedError("Artist profile not found");

  const result = await artistDashboardService.getAlbums({
    artistId,
    page: req.query.page,
    limit: req.query.limit,
  });

  res.status(200).json({ success: true, ...result });
};


export const getArtistDashboardStats = async (req, res) => {
  const artistId = req.user.artistId;
  if (!artistId) throw new UnauthorizedError("Artist profile not found");

  const stats = await artistDashboardService.getStats({ artistId });

  res.status(200).json({ success: true, data: stats });
};