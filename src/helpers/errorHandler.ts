import { Response } from "express";

/**
 * Handles errors in a safe way that doesn't leak sensitive information
 * Logs the actual error for debugging while returning a generic message to the client
 */
export const handleError = (
  res: Response,
  error: any,
  context: string,
  customMessage?: string
) => {
  // Log the full error for debugging (should use proper logger in production)
  console.error(`Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });

  // Return generic error message to client
  const message = customMessage || "An error occurred while processing your request";

  return res.status(500).json({ message });
};

/**
 * Handles validation errors with appropriate status code
 */
export const handleValidationError = (
  res: Response,
  message: string = "Invalid request parameters"
) => {
  return res.status(400).json({ message });
};

/**
 * Handles not found errors
 */
export const handleNotFoundError = (
  res: Response,
  message: string = "Resource not found"
) => {
  return res.status(404).json({ message });
};

/**
 * Handles unauthorized errors
 */
export const handleUnauthorizedError = (
  res: Response,
  message: string = "Unauthorized access"
) => {
  return res.status(401).json({ message });
};

/**
 * Handles forbidden errors
 */
export const handleForbiddenError = (
  res: Response,
  message: string = "Access forbidden"
) => {
  return res.status(403).json({ message });
};
