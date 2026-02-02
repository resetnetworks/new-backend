import { AppError } from "./app-error.js";

class ForbiddenError extends AppError {
  constructor(message = "Access forbidden") {
    super(message, 403);
  }
}

export default ForbiddenError;
