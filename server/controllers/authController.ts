// server/controllers/authController.ts
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { Types } from 'mongoose'; // <-- NEW IMPORT: ADD THIS LINE
import User, { IUser } from '../models/User';
import generateToken from '../utils/generateToken';

// Extend the Request interface to include the user property
declare module 'express' {
  interface Request {
    user?: IUser; // Add optional user property
  }
}

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400); // Bad request
    throw new Error('User with this email already exists');
  }

  // Create new user
  const user = await User.create({
    name,
    email,
    password, // Password will be hashed by the pre-save hook in the User model
  });

  if (user) {
    // If user created successfully, send back user data and a JWT
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken((user._id as Types.ObjectId).toHexString()), // <-- UPDATED LINE
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data provided');
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Check if user exists by email
  const user = await User.findOne({ email });

  // If user exists AND password matches (using the method defined in User model)
  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken((user._id as Types.ObjectId).toHexString()), // <-- UPDATED LINE
    });
  } else {
    res.status(401); // Unauthorized
    throw new Error('Invalid email or password');
  }
});

export { loginUser, registerUser };
