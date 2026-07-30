import MigrationAlbum from "../models/migrationAlbum.model.js";

const create = async (data) => {
  return await MigrationAlbum.create(data);
};

const findByJobId = async (migrationJobId) => {
  return await MigrationAlbum.find({ migrationJobId });
};

const findById = async (id) => {
  return await MigrationAlbum.findById(id);
};

const update = async (id, updateData) => {
  return await MigrationAlbum.findByIdAndUpdate(id, { $set: updateData }, { new: true });
};

const findAll = async () => {
  return await MigrationAlbum.find().sort({ createdAt: -1 });
};

export const migrationAlbumRepository = {
  create,
  findByJobId,
  findById,
  update,
  findAll,
};

export default migrationAlbumRepository;

