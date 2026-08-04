import { StatusCodes } from "http-status-codes";
import { migrationService } from "../services/migration.service.js";
import { migrationJobRepository } from "../repositories/migrationJob.repository.js";
import { migrationAlbumRepository } from "../repositories/migrationAlbum.repository.js";
import { migrationTrackRepository } from "../repositories/migrationTrack.repository.js";
import MigrationJob from "../models/migrationJob.model.js";
import MigrationAlbum from "../models/migrationAlbum.model.js";
import MigrationTrack from "../models/migrationTrack.model.js";

export const postBandcampMigration = async (req, res) => {
  const { url } = req.body;
  const workspaceId = req.user?.workspaceId || req.body.workspaceId;

  if (!workspaceId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Missing workspace context. Please check x-workspace-id header.",
    });
  }

  try {
    const job = await migrationService.createMigration(workspaceId, url, "bandcamp");
    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Migration job created successfully",
      data: job,
    });
  } catch (err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: err.message,
    });
  }
};

export const getMigrationStatus = async (req, res) => {
  const { id } = req.params;

  const job = await migrationJobRepository.findById(id);
  if (!job) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Migration job not found",
    });
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    data: job,
  });
};

export const getMigrationAlbums = async (req, res) => {
  const { id } = req.params;

  const albums = await migrationAlbumRepository.findByJobId(id);
  return res.status(StatusCodes.OK).json({
    success: true,
    data: albums,
  });
};

export const getMigrationTracks = async (req, res) => {
  const { id } = req.params;

  const albums = await migrationAlbumRepository.findByJobId(id);
  const albumIds = albums.map((a) => a._id);

  const tracks = await migrationTrackRepository.findByAlbumIds(albumIds);
  return res.status(StatusCodes.OK).json({
    success: true,
    data: tracks,
  });
};

export const postRetryMigration = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await migrationService.retryMigration(id);
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Migration job retried successfully",
      data: job,
    });
  } catch (err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: err.message,
    });
  }
};

export const postImportMigration = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?._id || req.user?.id || req.body.userId;

  try {
    const result = await migrationService.importMigration(id, userId);
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Data imported into production successfully",
      data: result,
    });
  } catch (err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: err.message,
    });
  }
};

export const getDraftAlbums = async (req, res) => {
  const workspaceId = req.user?.workspaceId;
  if (!workspaceId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Missing workspace context. Please check x-workspace-id header.",
    });
  }

  try {
    const jobs = await MigrationJob.find({ workspaceId });
    const jobIds = jobs.map((j) => j._id);
    const albums = await MigrationAlbum.find({ migrationJobId: { $in: jobIds }, status: "DRAFT" }).sort({ createdAt: -1 });

    return res.status(StatusCodes.OK).json({
      success: true,
      data: albums,
    });
  } catch (err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: err.message,
    });
  }
};

export const getDraftAlbumDetails = async (req, res) => {
  const { id } = req.params;
  const workspaceId = req.user?.workspaceId;
  if (!workspaceId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Missing workspace context. Please check x-workspace-id header.",
    });
  }

  try {
    const album = await MigrationAlbum.findById(id);
    if (!album) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Draft album not found",
      });
    }

    const job = await MigrationJob.findOne({ _id: album.migrationJobId, workspaceId });
    if (!job) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "Access denied: This album does not belong to your workspace",
      });
    }

    const tracks = await migrationTrackRepository.findByAlbumId(id);
    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        album,
        tracks,
      },
    });
  } catch (err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: err.message,
    });
  }
};

export const patchDraftAlbum = async (req, res) => {
  const { id } = req.params;
  const workspaceId = req.user?.workspaceId;
  if (!workspaceId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Missing workspace context. Please check x-workspace-id header.",
    });
  }

  try {
    const album = await MigrationAlbum.findById(id);
    if (!album) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Draft album not found",
      });
    }

    const job = await MigrationJob.findOne({ _id: album.migrationJobId, workspaceId });
    if (!job) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "Access denied: This album does not belong to your workspace",
      });
    }

    const updated = await migrationAlbumRepository.update(id, req.body);
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Draft album updated successfully",
      data: updated,
    });
  } catch (err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: err.message,
    });
  }
};

export const patchDraftTrack = async (req, res) => {
  const { id } = req.params;
  const workspaceId = req.user?.workspaceId;
  if (!workspaceId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Missing workspace context. Please check x-workspace-id header.",
    });
  }

  try {
    const track = await MigrationTrack.findById(id);
    if (!track) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Draft track not found",
      });
    }

    const album = await MigrationAlbum.findById(track.migrationAlbumId);
    if (!album) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Associated album not found",
      });
    }

    const job = await MigrationJob.findOne({ _id: album.migrationJobId, workspaceId });
    if (!job) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "Access denied: This track does not belong to your workspace",
      });
    }

    const updateData = { ...req.body };
    if (updateData.audioKey) {
      updateData.audioStatus = "READY";
    }

    const updatedTrack = await migrationTrackRepository.update(id, updateData);
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Draft track updated successfully",
      data: updatedTrack,
    });
  } catch (err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: err.message,
    });
  }
};

export const publishDraftAlbum = async (req, res) => {
  const { id } = req.params;
  const workspaceId = req.user?.workspaceId;
  const userId = req.user?._id || req.user?.id;
  if (!workspaceId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Missing workspace context. Please check x-workspace-id header.",
    });
  }

  const payload = req.body;


  try {
    const album = await MigrationAlbum.findById(id);
    if (!album) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Draft album not found",
      });
    }

    const job = await MigrationJob.findOne({ _id: album.migrationJobId, workspaceId, payload });
    if (!job) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "Access denied: This album does not belong to your workspace",
      });
    }

    const result = await migrationService.publishAlbumToProduction(id, userId);
    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Draft album and tracks published to production successfully",
      data: result,
    });
  } catch (err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: err.message,
    });
  }
};

export const migrationController = {
  postBandcampMigration,
  getMigrationStatus,
  getMigrationAlbums,
  getMigrationTracks,
  postRetryMigration,
  postImportMigration,
  getDraftAlbums,
  getDraftAlbumDetails,
  patchDraftAlbum,
  patchDraftTrack,
  publishDraftAlbum,
};

export default migrationController;

