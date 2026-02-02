import { AppError } from "./app-error.js";

class UnauthenticatedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
  }
}

export default UnauthenticatedError;
