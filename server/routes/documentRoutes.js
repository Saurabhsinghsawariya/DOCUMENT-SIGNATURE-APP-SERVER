// server/routes/documentRoutes.js
import express from 'express';
import {
    applySignatures,
    deleteDocument,
    downloadDocument,
    getDocumentById,
    // ✨ NEW: Import getDocumentContent
    getDocumentContent,
    getDocuments,
    getSharedWithMeDocuments,
    shareDocument,
    uploadDocument,
} from '../controllers/documentController.js'; // .js extension
import { protect } from '../middleware/authMiddleware.js'; // .js extension
import { upload } from '../middleware/multerMiddleware.js'; // Corrected to NAMED import

const router = express.Router();

// All routes below this will use the protect middleware
router.use(protect);

// Main document operations
router.post('/upload', upload.single('document'), uploadDocument);
router.get('/', getDocuments);

// --- CRITICAL ROUTING ORDER ---
// Define more specific routes before more general ones to prevent ID casting errors

// 1. Specific path for 'shared-with-me'
router.get('/shared-with-me', getSharedWithMeDocuments);

// ✨ NEW ROUTE: Fetch PDF content for display (comes before general :id route)
// This route is specific enough (has '/content') that it should be fine here,
// but generally, place more specific GET routes before the general '/:id' GET route.
router.get('/:id/content', getDocumentContent);


// 2. This general route for fetching by ID must come AFTER any specific string paths (like /shared-with-me)
router.get('/:id', getDocumentById);

// Routes for specific document actions
router.post('/:id/sign', applySignatures); // Renamed from applySignature to applySignatures (plural) for consistency if it applies multiple
router.put('/:id/share', shareDocument);
router.delete('/:id', deleteDocument);
router.get('/:id/download', downloadDocument);


export default router;