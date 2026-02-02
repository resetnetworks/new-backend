// utils/logger.js
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "req.body.card"
    ],
    remove: true
  }
});

export default logger;