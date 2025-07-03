import { NextFunction, Request, Response } from 'express';

// Middleware to handle 404 (Not Found) errors
const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404); // Set status to 404
  next(error); // Pass the error to the next error handling middleware
};

// General error handling middleware
// This will catch errors thrown by route handlers or other middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Determine the status code. If it's still 200 (OK) despite an error, change to 500 (Internal Server Error)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    // In development, include the stack trace for debugging; in production, hide it.
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

export { errorHandler, notFound };
