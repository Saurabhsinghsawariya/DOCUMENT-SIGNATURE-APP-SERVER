// server/routes/authRoutes.ts
import express from 'express';
import { loginUser, registerUser } from '../controllers/authController';
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

export default router; // <-- THIS LINE IS CRUCIAL! Make sure it's there.