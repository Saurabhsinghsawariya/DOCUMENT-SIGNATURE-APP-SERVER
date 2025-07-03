import { NextFunction, Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User'; // Import User model and its interface

// Extend the Request interface for TypeScript to recognize req.user
declare module 'express' {
  interface Request {
    user?: IUser; // Add optional user property to the Request object
  }
}

const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // Check if the Authorization header exists and starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract the token (e.g., "Bearer YOUR_TOKEN_HERE")
      token = req.headers.authorization.split(' ')[1];

      // Ensure JWT_SECRET environment variable is defined
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not defined.');
      }

      // Verify the token using your JWT_SECRET
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string };

      // Find the user by the ID extracted from the token payload
      // .select('-password') ensures the password hash is not returned
      req.user = await User.findById(decoded.id).select('-password');

      next(); // If verification is successful, proceed to the next middleware or route handler
    } catch (error) {
      console.error(error);
      res.status(401); // Unauthorized
      throw new Error('Not authorized, token failed');
    }
  }

  // If no token was provided in the request
  if (!token) {
    res.status(401); // Unauthorized
    throw new Error('Not authorized, no token provided');
  }
});

export { protect };
