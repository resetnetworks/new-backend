import { AppError } from "./app-error.js";

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export default NotFoundError;
