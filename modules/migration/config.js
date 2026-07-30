export default {
  MONGO_URL: process.env.MONGO_URL,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || "reset-streaming",
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || "development",
};
