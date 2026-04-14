import mongoose from "mongoose";
import { StatusCodes } from 'http-status-codes';
import { Playlist } from "../models/Playlist.js";
import { createPlaylistService, getMyPlaylistsService, updatePlaylistService, addSongToPlaylistService, deletePlaylistService,
  removeSongsFromPlaylistService, getPlaylistByIdService
 } from "../services/playlist.service.js";
import { shapePlaylistResponse } from "../dto/playlist.dto.js";


export const createPlaylist = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const { name, description, isPublic } = req.body;

    const playlist = await createPlaylistService({
      userId,
      name,
      description,
      isPublic,
    });

    req.log.info({
      event: "playlist.created",
      userId,
      playlistId: playlist._id,
    });

    return res.status(201).json({
      message: "Playlist created successfully",
      playlist: shapePlaylistResponse(playlist),
    });
  } catch (err) {
    next(err);
  }
};

export const getMyPlaylists = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const { playlists, total } = await getMyPlaylistsService({ userId, query: req.query });

    req.log.info({
      event: "playlist.list_my",
      userId,
      count: playlists.length,
    });

    return res.status(200).json({
      message: "Playlists fetched successfully",
      count: playlists.length,
      total,
      playlists: playlists.map(shapePlaylistResponse),
    });
  } catch (err) {
    next(err);
  }
};


export const updatePlaylist = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { playlistId } = req.params;

    const playlist = await updatePlaylistService({
      playlistId,
      userId,
      updates: req.body,
    });

    req.log.info({
      event: "playlist.updated",
      userId,
      playlistId,
    });

    return res.status(200).json({
      message: "Playlist updated successfully",
      playlist: shapePlaylistResponse(playlist),
    });
  } catch (err) {
    next(err);
  }
};

export const deletePlaylist = async (req, res, next) => {
  try {
    const { id: playlistId } = req.params;
    const userId = req.user?._id;
    const userRole = req.user?.role || "user";

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
      return res.status(400).json({ message: "Invalid playlist ID" });
    }

    await deletePlaylistService({
      playlistId,
      userId,
      userRole,
    });

    req.log?.info({
      event: "playlist.deleted",
      userId,
      playlistId,
    });

    return res.status(200).json({
      success: true,
      message: "Playlist deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const addSongToPlaylist = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {playlistId} = req.params;
    const { songId } = req.body;
    
   

    const playlist = await addSongToPlaylistService({
      playlistId,
      songId,
      userId,
    });

    req.log.info({
      event: "playlist.song_added",
      userId,
      playlistId,
      songId,
    });

    return res.status(200).json({
      message: "Song added successfully",
      playlist: shapePlaylistResponse(playlist),
    });
  } catch (err) {
    next(err);
  }
};


export const removeSongFromPlaylist = async (req, res, next) => {
  try {
    const { id: playlistId } = req.params;
    const { songIds } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!Array.isArray(songIds) || songIds.length === 0) {
      return res.status(400).json({
        message: "songIds array is required and cannot be empty",
      });
    }

    const result = await removeSongsFromPlaylistService({
      playlistId,
      userId,
      songIds,
    });

    req.log?.info({
      event: "playlist.songs.removed",
      userId,
      playlistId,
      removedCount: result.removedCount,
    });

    return res.status(200).json({
      message: "Songs removed successfully",
      removedCount: result.removedCount,
    });
  } catch (error) {
    next(error);
  }
};


export const getPublicPlaylists = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (page - 1) * limit;

    // 1️⃣ Build filter
    const filter = {
      visibility: "public",
      ...(search
        ? { name: { $regex: search, $options: "i" } }
        : {}),
    };

    // 2️⃣ Fetch public playlists with creator + songs preview
    const playlists = await Playlist.find(filter)
      .populate({
        path: "createdBy",
        select: "name username",
      })
      .populate({
        path: "songs",
        select: "title artist coverImage duration",
        options: { limit: 3 }, // only show top 3 songs preview
      })
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    // 3️⃣ Count total for pagination
    const total = await Playlist.countDocuments(filter);

    // 4️⃣ Shape lightweight response (DTO-style)
    const shaped = playlists.map((p) => ({
      id: p._id,
      name: p.name,
      description: p.description,
      visibility: p.visibility,
      createdAt: p.createdAt,
      createdBy: p.createdBy
        ? {
            id: p.createdBy._id,
            name: p.createdBy.name,
            username: p.createdBy.username,
          }
        : null,
      songCount: p.songs?.length || 0,
      songsPreview:
        p.songs?.map((s) => ({
          id: s._id,
          title: s.title,
          artist: s.artist,
          coverImage: s.coverImage,
          duration: s.duration,
        })) || [],
    }));

    // 5️⃣ Send paginated result
    res.status(StatusCodes.OK).json({
      success: true,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      totalPlaylists: total,
      data: shaped,
    });
  } catch (err) {
    console.error("Error fetching public playlists:", err);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Server error", error: err.message });
  }
};


export const getPlaylistById = async (req, res, next) => {
  try {
    const { id: playlistId } = req.params;
    const userId = req.user?._id;

    const { page = 1, limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
      return res.status(400).json({ message: "Invalid playlist ID" });
    }

    const result = await getPlaylistByIdService({
      playlistId,
      userId,
      page: Number(page),
      limit: Number(limit),
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};
