import { Song } from "../models/song.model.js";
import "../modules/artist/models/artist.model.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { checkSongCopyright } from "../services/audd.service.js";
import { buildCdnUrl } from "../utils/cdn/cdn.js";

/**
 * GET /api/v1/admin/copyright/unverified
 * List all unverified songs for admin review & copyright moderation
 */
export const getUnverifiedSongs = async (req, res) => {
  const { page = 1, limit = 20, statusFilter, search } = req.query;

  const query = {
    isVerified: false,
    isDeleted: { $ne: true },
  };

  // Filter by AudD match status if provided
  if (statusFilter && ["clean", "match_found", "pending", "takedown"].includes(statusFilter)) {
    query["copyrightCheck.status"] = statusFilter;
  }

  // Optional search by title
  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [songs, total] = await Promise.all([
    Song.find(query)
      .populate("artist", "name email profileImageKey")
      .populate("album", "title coverImageKey")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    Song.countDocuments(query),
  ]);

  // Format response with CDN URLs for previewing
  const formattedSongs = songs.map((song) => ({
    ...song,
    audioUrl: song.audioKey ? buildCdnUrl(song.audioKey) : null,
    coverImageUrl: song.coverImageKey ? buildCdnUrl(song.coverImageKey) : null,
  }));

  res.json({
    success: true,
    count: formattedSongs.length,
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / parseInt(limit, 10)),
    data: formattedSongs,
  });
};

/**
 * POST /api/v1/admin/copyright/verify/:songId
 * Mark a song as verified by admin (remains published with verified badge)
 */
export const verifySong = async (req, res) => {
  const { songId } = req.params;

  const song = await Song.findById(songId);
  if (!song || song.isDeleted) {
    throw new NotFoundError("Song not found");
  }

  song.isVerified = true;
  song.isPublished = true;
  song.verifiedAt = new Date();
  song.verifiedBy = req.user?._id || null;

  await song.save();

  res.json({
    success: true,
    message: "Song successfully verified and published",
    data: {
      songId: song._id,
      title: song.title,
      isVerified: song.isVerified,
      isPublished: song.isPublished,
      verifiedAt: song.verifiedAt,
    },
  });
};

/**
 * POST /api/v1/admin/copyright/takedown/:songId
 * Unpublish/take down a song due to copyright violation or issue
 */
export const takedownSong = async (req, res) => {
  const { songId } = req.params;
  const { reason = "Copyright infringement detected" } = req.body;

  const song = await Song.findById(songId);
  if (!song || song.isDeleted) {
    throw new NotFoundError("Song not found");
  }

  song.isPublished = false;
  song.isVerified = false;
  song.copyrightCheck.status = "takedown";
  song.takedownReason = reason;
  song.takedownAt = new Date();

  await song.save();

  res.json({
    success: true,
    message: "Song has been taken down and unpublished",
    data: {
      songId: song._id,
      title: song.title,
      isPublished: song.isPublished,
      isVerified: song.isVerified,
      takedownReason: song.takedownReason,
      takedownAt: song.takedownAt,
    },
  });
};

/**
 * POST /api/v1/admin/copyright/scan/:songId
 * Manually trigger or re-run AudD copyright check for a song
 */
export const runCopyrightScan = async (req, res) => {
  const { songId } = req.params;

  const song = await Song.findById(songId);
  if (!song || song.isDeleted) {
    throw new NotFoundError("Song not found");
  }

  const copyrightCheck = await checkSongCopyright(song._id);

  res.json({
    success: true,
    message: "Copyright scan completed",
    data: copyrightCheck,
  });
};
