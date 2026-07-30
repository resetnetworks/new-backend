import MigrationJob from "../models/migrationJob.model.js";

const create = async (data) => {
  return await MigrationJob.create(data);
};

const findById = async (id) => {
  return await MigrationJob.findById(id);
};

const update = async (id, updateData) => {
  return await MigrationJob.findByIdAndUpdate(id, { $set: updateData }, { new: true });
};

const findDuplicate = async (sourceUrl, workspaceId) => {
  return await MigrationJob.findOne({
    sourceUrl,
    workspaceId,
    status: { $in: ["PENDING", "SCRAPING", "NORMALIZING", "DOWNLOADING_ASSETS", "READY"] },
  });
};

const updateStatus = async (id, status, progress, currentStep, error = null) => {
  const updateData = { status, progress, currentStep };
  if (error) updateData.error = error;
  if (status === "SCRAPING" && !updateData.startedAt) {
    updateData.startedAt = new Date();
  }
  if (status === "READY" || status === "FAILED") {
    updateData.completedAt = new Date();
  }
  return await MigrationJob.findByIdAndUpdate(id, { $set: updateData }, { new: true });
};

const incrementRetries = async (id) => {
  return await MigrationJob.findByIdAndUpdate(id, { $inc: { retries: 1 } }, { new: true });
};

export const migrationJobRepository = {
  create,
  findById,
  update,
  findDuplicate,
  updateStatus,
  incrementRetries,
};

export default migrationJobRepository;
