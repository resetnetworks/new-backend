import MigrationAsset from "../models/migrationAsset.model.js";

const create = async (data) => {
  return await MigrationAsset.create(data);
};

const findByJobId = async (migrationJobId) => {
  return await MigrationAsset.find({ migrationJobId });
};

const findByUrlAndJobId = async (originalUrl, migrationJobId) => {
  return await MigrationAsset.findOne({ originalUrl, migrationJobId });
};

const update = async (id, updateData) => {
  return await MigrationAsset.findByIdAndUpdate(id, { $set: updateData }, { new: true });
};

const findDownloadedAssetByUrl = async (originalUrl) => {
  return await MigrationAsset.findOne({ originalUrl, status: "DOWNLOADED" }).lean();
};

export const migrationAssetRepository = {
  create,
  findByJobId,
  findByUrlAndJobId,
  update,
  findDownloadedAssetByUrl,
};

export default migrationAssetRepository;
