// server/server.ts

console.log('--- SERVER.TS FILE IS STARTING EXECUTION ---');

import 'colors';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import connectDB from './config/db';

// Import routes and middleware
import { errorHandler, notFound } from './middleware/errorMiddleware';
import authRoutes from './routes/authRoutes';
import documentRoutes from './routes/documentRoutes';

// Load environment variables from .env file (located at project root)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// Connect to Database
connectDB();

// Middleware
// IMPORTANT UPDATE: Increase the JSON body parsing limit to handle large Base64 image data
app.use(express.json({ limit: '50mb' })); // Body parser for JSON requests (increased limit)

// Configure CORS to allow requests from your frontend
// This MUST come before any of your route definitions
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173', // Your frontend's origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  credentials: true, // Important for cookies/auth headers if used
  optionsSuccessStatus: 204 // Standard for preflight requests
}));
console.log(`--- CORS Middleware HAS BEEN APPLIED with origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'} ---`);

// Define API Routes
app.use('/api/auth', authRoutes);
app.use('/api/docs', documentRoutes);

// Basic route to check if API is running
app.get('/', (req: Request, res: Response) => {
  res.send('API is running...');
});

// Place error handling middleware after all your routes
app.use(notFound);
app.use(errorHandler);

// Define Port
const PORT = process.env.PORT || 8000; // Server will run on port 8000

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`.yellow.bold);
});