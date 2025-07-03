// server/routes/documentRoutes.ts
import express from 'express';
import {
    applySignature,
    deleteDocument,
    getDocumentById,
    getMyDocuments,
    updateDocument,
    uploadDocument,
    viewDocument,
} from '../controllers/documentController';
import { protect } from '../middleware/authMiddleware'; // Auth middleware
import upload from '../utils/fileUpload'; // Multer middleware

const router = express.Router();

// Route for uploading a document. Uses 'upload.single('document')' for one file.
// The field name 'document' must match the 'name' attribute of the file input in your HTML form.
router.post('/upload', protect, upload.single('document'), uploadDocument);

// GET route for all documents for the authenticated user
router.get('/', protect, getMyDocuments);

// GET route for a single document by ID (metadata only)
router.get('/:id', protect, getDocumentById);

// DELETE route for a document
router.delete('/:id', protect, deleteDocument);

// GET route to view/serve the actual PDF file
router.get('/view/:id', protect, viewDocument);

// PUT route to update document metadata (e.g., status)
router.put('/:id', protect, updateDocument);

// --- NEW ROUTE FOR APPLYING SIGNATURE ---
// This route will handle the POST request from the frontend to apply a signature
router.post('/sign/:id', protect, applySignature); // <--- ADDED THIS LINE

export default router;