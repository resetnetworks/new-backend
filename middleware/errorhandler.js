import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

const errorHandlerMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message =
    err.message || "Something went wrong, please try again later.";

  /* -------------------- Mongoose: ValidationError -------------------- */
  if (err.name === "ValidationError") {
    statusCode = StatusCodes.BAD_REQUEST;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  /* -------------------- Mongoose: Duplicate Key -------------------- */
  if (err.code === 11000) {
    statusCode = StatusCodes.BAD_REQUEST;
    const fields = Object.keys(err.keyValue).join(", ");
    message = `Duplicate value entered for: ${fields}`;
  }

  /* -------------------- Mongoose: CastError -------------------- */
  if (err.name === "CastError") {
    statusCode = StatusCodes.NOT_FOUND;
    message = `Resource not found with id: ${err.value}`;
  }

  /* -------------------- Logging (ONCE, structured) -------------------- */
  const logLevel = statusCode >= 500 ? "error" : "warn";

  logger[logLevel](
    {
      err,
      statusCode,
      path: req.originalUrl,
      method: req.method,
      userId: req.user?._id
    },
    "Request failed"
  );

  /* -------------------- Response -------------------- */
  const response = {
    success: false,
    message
  };

  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

export default errorHandlerMiddleware;
