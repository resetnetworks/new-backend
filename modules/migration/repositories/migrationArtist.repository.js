import MigrationArtist from "../models/migrationArtist.model.js";

const create = async (data) => {
  return await MigrationArtist.create(data);
};

const findByJobId = async (migrationJobId) => {
  return await MigrationArtist.findOne({ migrationJobId });
};

const updateByJobId = async (migrationJobId, updateData) => {
  return await MigrationArtist.findOneAndUpdate({ migrationJobId }, { $set: updateData }, { new: true });
};

const findById = async (id) => {
  return await MigrationArtist.findById(id);
};

export const migrationArtistRepository = {
  create,
  findByJobId,
  updateByJobId,
  findById,
};

export default migrationArtistRepository;

