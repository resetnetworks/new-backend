import { BadRequestError} from "../errors/index.js";
import { Playlist } from "../models/Playlist.js";
import mongoose from "mongoose";
import { Song } from "../models/song.model.js";




export const createPlaylistService = async ({
  userId,
  name,
  description,
  isPublic,
}) => {
  if (!name || typeof name !== "string" || !name.trim()) {
    throw new BadRequestError("Playlist name is required");
  }

  const normalizedName = name.trim();

  // Optional duplicate check
  const existing = await Playlist.findOne({
    name: normalizedName,
    createdBy: userId,
  }).lean();

  if (existing) {
    throw new BadRequestError("Playlist already exists");
  }

  const playlist = await Playlist.create({
    name: normalizedName,
    description: description?.trim() || "",
    createdBy: userId,
    isPublic: Boolean(isPublic),
  });

  return playlist;
};


export const getMyPlaylistsService = async ({ userId, query }) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, parseInt(query.limit) || 10);
  const skip = (page - 1) * limit;

  const [playlists, total] = await Promise.all([
    Playlist.find({ createdBy: userId })
      .select("name description isPublic songs createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Playlist.countDocuments({ createdBy: userId }),
  ]);

  return { playlists, total };
};


export const updatePlaylistService = async ({
  playlistId,
  userId,
  updates,
}) => {
  if (!mongoose.Types.ObjectId.isValid(playlistId)) {
    throw new BadRequestError("Invalid playlist ID");
  }

  const allowedUpdates = {};

  // -------------------
  // Validate + normalize
  // -------------------

  if (updates.name !== undefined) {
    if (typeof updates.name !== "string" || !updates.name.trim()) {
      throw new BadRequestError("Invalid playlist name");
    }
    allowedUpdates.name = updates.name.trim();
  }

  if (updates.description !== undefined) {
    if (typeof updates.description !== "string") {
      throw new BadRequestError("Invalid description");
    }
    allowedUpdates.description = updates.description.trim();
  }

  if (updates.isPublic !== undefined) {
    allowedUpdates.isPublic = Boolean(updates.isPublic);
  }

  // -------------------
  // Atomic update
  // -------------------

  const playlist = await Playlist.findOneAndUpdate(
    { _id: playlistId, createdBy: userId }, // ownership enforced here
    { $set: allowedUpdates },
    { new: true, runValidators: true }
  ).lean();

  if (!playlist) {
    throw new NotFoundError("Playlist not found or not authorized");
  }

  return playlist;
};


export const addSongToPlaylistService = async ({
  playlistId,
  songId,
  userId,
}) => {
    
   
  if (
    !mongoose.Types.ObjectId.isValid(playlistId) ||
    !mongoose.Types.ObjectId.isValid(songId)
  ) {
    throw new BadRequestError("Invalid playlist or song ID");
  }

  // 1️⃣ Ensure song exists
  const songExists = await Song.exists({ _id: songId });
  if (!songExists) {
    throw new NotFoundError("Song not found");
  }

  // 2️⃣ Atomic update with ownership check
  const playlist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      createdBy: userId,
      songs: { $ne: songId }, // prevents duplicates
    },
    {
      $addToSet: { songs: songId },
    },
    {
      new: true,
    }
  ).lean();

  if (!playlist) {
    // Could be:
    // - not found
    // - not owner
    // - already exists
    throw new ConflictError("Song already exists or not authorized");
  }

  return playlist;
};

export const deletePlaylistService = async ({
  playlistId,
  userId,
  userRole,
}) => {
  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new NotFoundError("Playlist not found");
  }

  const isOwner = playlist.createdBy.toString() === userId.toString();
  const isAdmin = userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("Not allowed to delete this playlist");
  }

  // 👉 Prefer soft delete
  playlist.isDeleted = true;
  playlist.deletedAt = new Date();

  await playlist.save();
};

export const removeSongsFromPlaylistService = async ({
  playlistId,
  userId,
  songIds,
}) => {
  // Validate ObjectIds
  const validSongIds = songIds.filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );

  if (validSongIds.length === 0) {
    throw new BadRequestError("Invalid songIds");
  }

  // First check ownership
  const playlist = await Playlist.findOne({
    _id: playlistId,
    createdBy: userId,
  }).select("_id songs");

  if (!playlist) {
    throw new NotFoundError("Playlist not found or not owned by user");
  }

  const beforeCount = playlist.songs.length;

  // Atomic removal
  const updated = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: {
        songs: { $in: validSongIds },
      },
    },
    { new: true }
  ).select("songs");

  const afterCount = updated.songs.length;

  return {
    removedCount: beforeCount - afterCount,
  };
};


export const getPlaylistByIdService = async ({
  playlistId,
  userId,
  page,
  limit,
}) => {
  const playlist = await Playlist.findById(playlistId)
    .select("name description isPublic createdBy createdAt songs")
    .populate({
      path: "createdBy",
      select: "name username",
    })
    .lean();

  if (!playlist) {
    throw new NotFoundError("Playlist not found");
  }

  // Access control
  if (
    !playlist.isPublic &&
    (!userId || playlist.createdBy._id.toString() !== userId.toString())
  ) {
    throw new ForbiddenError("Access denied");
  }

  // Pagination
  const start = (page - 1) * limit;
  const paginatedSongIds = playlist.songs.slice(start, start + limit);

  // Fetch songs separately (BETTER than populate)
  const songs = await Song.find({
    _id: { $in: paginatedSongIds },
    isDeleted: false,
    status: "ready",
  })
    .select("title artist album duration coverImageKey accessType")
    .populate({ path: "artist", select: "name slug" })
    .lean();

  return {
    data: {
      id: playlist._id,
      name: playlist.name,
      description: playlist.description,
      isPublic: playlist.isPublic,
      createdAt: playlist.createdAt,
      createdBy: shapeUserResponse(playlist.createdBy),
      songs: songs.map((song) =>
        shapeSongResponse(song, { userId }) // apply access control
      ),
    },
    pagination: {
      page,
      limit,
      totalSongs: playlist.songs.length,
      hasMore: start + limit < playlist.songs.length,
    },
  };
};