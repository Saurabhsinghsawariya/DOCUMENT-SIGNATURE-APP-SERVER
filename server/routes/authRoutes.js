// server/routes/authRoutes.js
import express from 'express';
import { getUserProfile, loginUser, registerUser } from '../controllers/authController.js'; // .js extension
import { protect } from '../middleware/authMiddleware.js'; // .js extension

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);

export default router; // Default export