import MigrationTrack from "../models/migrationTrack.model.js";

const create = async (data) => {
  return await MigrationTrack.create(data);
};

const findByAlbumId = async (migrationAlbumId) => {
  return await MigrationTrack.find({ migrationAlbumId }).sort({ trackNumber: 1 });
};

const findByAlbumIds = async (migrationAlbumIds) => {
  return await MigrationTrack.find({ migrationAlbumId: { $in: migrationAlbumIds } }).sort({ trackNumber: 1 });
};

const findById = async (id) => {
  return await MigrationTrack.findById(id);
};

const update = async (id, data) => {
  return await MigrationTrack.findByIdAndUpdate(id, { $set: data }, { new: true });
};

export const migrationTrackRepository = {
  create,
  findByAlbumId,
  findByAlbumIds,
  findById,
  update,
};

export default migrationTrackRepository;

