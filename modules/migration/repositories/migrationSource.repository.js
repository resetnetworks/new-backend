import MigrationSource from "../models/migrationSource.model.js";

const create = async (data) => {
  return await MigrationSource.create(data);
};

const findByJobId = async (migrationJobId) => {
  return await MigrationSource.findOne({ migrationJobId }).lean();
};

export const migrationSourceRepository = {
  create,
  findByJobId,
};

export default migrationSourceRepository;
