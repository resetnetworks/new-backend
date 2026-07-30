import { normalizeData } from "../adapters/bandcamp/normalizer/bandcampNormalizer.js";

export const normalize = (parsedData, migrationJobId) => {
  return normalizeData(parsedData, migrationJobId);
};

export const bandcampNormalizerService = {
  normalize,
};

export default bandcampNormalizerService;
