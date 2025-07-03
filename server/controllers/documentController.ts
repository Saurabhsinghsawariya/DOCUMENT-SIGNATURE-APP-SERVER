// server/controllers/documentController.ts

import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import fs from 'fs/promises'; // Correct: Use fs/promises for async operations
import { Types } from 'mongoose'; // For explicit type casting of ObjectId
import path from 'path'; // For path manipulation

// Import PDF-LIB for PDF manipulation
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'; // Added rgb and StandardFonts for text signatures
import Document from '../models/Document'; // Import Document model
import { IUser } from '../models/User'; // Import IUser interface (for req.user typing)

// Extend the Request interface to include the user property (from authMiddleware)
// and file property (from Multer)
declare module 'express' {
  interface Request {
    user?: IUser; // Attached by protect middleware
    file?: Express.Multer.File; // Attached by Multer middleware
  }
}

// Define paths for uploads and signed documents
const UPLOADS_DIR = path.join(__dirname, '../../uploads'); // Not directly used in this file, but good for context
const SIGNED_DOCS_DIR = path.join(__dirname, '../../signed_documents');

// Ensure the signed documents directory exists on server startup
const ensureSignedDocsDir = async () => {
  try {
    await fs.mkdir(SIGNED_DOCS_DIR, { recursive: true });
    console.log(`Ensured signed documents directory exists: ${SIGNED_DOCS_DIR}`.green.bold);
  } catch (error) {
    console.error(`Error ensuring signed documents directory: ${error}`.red.bold);
  }
};
ensureSignedDocsDir(); // Call this once when the server starts

// Removed saveBase64ImageTemp as it's no longer used in applySignature for efficiency.

// @desc    Upload new document
// @route   POST /api/docs/upload
// @access  Private
const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded.');
  }

  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, no user token');
  }

  const { originalname, filename, path: filePath, mimetype, size } = req.file;

  const document = await Document.create({
    user: req.user._id,
    fileName: filename,
    filePath: filePath, // This will be the path to the original file in 'uploads'
    originalName: originalname,
    fileType: mimetype,
    fileSize: size,
    uploadDate: new Date(),
    status: 'pending', // Default status for new uploads
  });

  if (document) {
    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        _id: document._id,
        fileName: document.fileName,
        originalName: document.originalName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        uploadDate: document.uploadDate,
        status: document.status,
      },
    });
  } else {
    res.status(500);
    throw new Error('Failed to save document metadata.');
  }
});

// @desc    Get all documents for the authenticated user
// @route   GET /api/docs
// @access  Private
const getMyDocuments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, no user token');
  }

  const documents = await Document.find({ user: req.user._id }).sort({ uploadDate: -1 });

  res.status(200).json(documents);
});


// @desc    Get a single document by ID (metadata)
// @route   GET /api/docs/:id
// @access  Private
const getDocumentById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, no user token');
  }

  const document = await Document.findById(req.params.id);

  if (document) {
    if (document.user.toString() !== (req.user._id as Types.ObjectId).toString()) {
      res.status(403); // Forbidden
      throw new Error('Not authorized to view this document');
    }
    res.status(200).json(document);
  } else {
    res.status(404);
    throw new Error('Document not found'); // FIX: Removed extra 'new'
  }
});

// @desc    Delete a document
// @route   DELETE /api/docs/:id
// @access  Private
const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, no user token');
  }

  const document = await Document.findById(req.params.id);

  if (document) {
    if (document.user.toString() !== (req.user._id as Types.ObjectId).toString()) {
      res.status(403); // Forbidden
      throw new Error('Not authorized to delete this document');
    }

    // Delete the file that document.filePath currently points to (could be original or signed)
    try {
      await fs.access(document.filePath); // Check if file exists
      await fs.unlink(document.filePath); // Delete the actual file
      console.log(`Successfully deleted file: ${document.filePath}`);
    } catch (error: any) {
      // Log the error but don't stop execution if file doesn't exist (e.g., already deleted),
      // as the document might still need to be removed from DB.
      if (error.code === 'ENOENT') { // 'ENOENT' means file does not exist
        console.warn(`File not found at ${document.filePath} for deletion, proceeding with DB removal.`);
      } else {
        console.error(`Error deleting file from filesystem at ${document.filePath}:`, error);
      }
    }

    await Document.deleteOne({ _id: document._id }); // Delete from database

    res.status(200).json({ message: 'Document removed' });
  } else {
    res.status(404);
    throw new Error('Document not found');
  }
});

// @desc    View a specific document (serve the PDF file)
// @route   GET /api/docs/view/:id
// @access  Private
const viewDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, no user token');
  }

  const document = await Document.findById(req.params.id);

  if (document) {
    // Ensure the document belongs to the authenticated user
    if (document.user.toString() !== (req.user._id as Types.ObjectId).toString()) {
      res.status(403); // Forbidden
      throw new Error('Not authorized to view this document');
    }

    const filePathToServe = document.filePath;

    try {
      // Check if the file exists before sending
      await fs.access(filePathToServe); // Throws an error if file does not exist

      // Set headers for PDF viewing
      res.setHeader('Content-Type', 'application/pdf');
      // FIX: Use encodeURIComponent directly, remove deprecated escape
      const safeOriginalName = encodeURIComponent(document.originalName);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${safeOriginalName}`);
      res.sendFile(filePathToServe); // Send the file
    } catch (fileError) {
      console.error(`File not found at ${filePathToServe}:`, fileError);
      res.status(404);
      throw new Error('File not found on server.');
    }
  } else {
    res.status(404);
    throw new Error('Document metadata not found.');
  }
});


// @desc    Apply a signature to a document
// @route   POST /api/docs/sign/:id
// @access  Private
const applySignature = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, no user token');
  }

  const documentId = req.params.id;
  const {
    signatureData, // Base64 string for image, or plain text for text signature
    signaturePosition, // {x: number, y: number} from frontend
    pdfPageDimensions, // {width: number, height: number} of rendered PDF on frontend
    pageNumber,
    signatureType, // 'draw', 'upload', 'text'
    signatureFileExtension // 'png', 'jpeg' (only for image types)
  } = req.body;

  // --- START: Detailed Validation Checks ---
  console.log('--- Inside applySignature controller ---'.cyan.bold);
  console.log('Full Request Body Received (first 500 chars):', JSON.stringify(req.body).substring(0, 500) + '...');
  console.log('Validating incoming data...');

  if (!signatureData || typeof signatureData !== 'string' || signatureData.trim() === '') {
    console.error('Validation Error: signatureData is missing, not a string, or empty.');
    res.status(400);
    throw new Error('Missing or empty signature data.');
  }

  if (!signaturePosition || typeof signaturePosition.x !== 'number' || typeof signaturePosition.y !== 'number') {
    console.error('Validation Error: Invalid signaturePosition.');
    res.status(400);
    throw new Error('Invalid signaturePosition. Must be an object with numeric x and y.');
  }

  if (!pdfPageDimensions || typeof pdfPageDimensions.width !== 'number' || typeof pdfPageDimensions.height !== 'number' || pdfPageDimensions.width <= 0 || pdfPageDimensions.height <= 0) {
    console.error('Validation Error: Invalid pdfPageDimensions.');
    res.status(400);
    throw new Error('Invalid PDF container dimensions. Must be an object with positive numeric width and height.');
  }

  if (typeof pageNumber !== 'number' || pageNumber < 1) {
    console.error('Validation Error: Invalid pageNumber.');
    res.status(400);
    throw new Error('Invalid page number. Must be a positive integer.');
  }

  if (!signatureType || !['draw', 'upload', 'text'].includes(signatureType)) {
    console.error('Validation Error: Invalid signatureType.');
    res.status(400);
    throw new Error('Invalid signature type. Must be "draw", "upload", or "text".');
  }

  // Validate signatureData format based on type
  if (signatureType === 'draw' || signatureType === 'upload') {
    if (!signatureData.startsWith('data:image/')) {
        console.error('Validation Error: Image signatureData does not start with data:image/.');
        res.status(400);
        throw new Error('Image signature data must be a valid data URL (e.g., data:image/png;base64,...).');
    }
    // Ensure signatureFileExtension is provided and valid for image types
    if (!signatureFileExtension || typeof signatureFileExtension !== 'string' || !['png', 'jpeg', 'jpg'].includes(signatureFileExtension.toLowerCase())) {
        console.error('Validation Error: Invalid or missing signatureFileExtension for image type.');
        res.status(400);
        throw new Error('Missing or invalid signature file extension for image types. Must be "png" or "jpeg".'); // FIX: Removed extra 'new' here
    }
  } else if (signatureType === 'text') {
      // No specific format validation for text beyond being a non-empty string
  }

  console.log('Data validation passed.');
  // --- END: Detailed Validation Checks ---

  // Log parsed data for debugging purposes
  console.log('signatureData length:', signatureData.length);
  console.log('signaturePosition:', signaturePosition);
  console.log('pdfPageDimensions:', pdfPageDimensions);
  console.log('pageNumber:', pageNumber);
  console.log('signatureType:', signatureType);
  console.log('signatureFileExtension:', signatureFileExtension);

  try {
    const document = await Document.findById(documentId);

    if (!document) {
      res.status(404);
      throw new Error('Document not found.');
    }

    if (document.user.toString() !== (req.user._id as Types.ObjectId).toString()) {
      res.status(403); // Forbidden
      throw new Error('Not authorized to sign this document.');
    }

    // Read the current version of the PDF (could be original or already signed)
    const existingPdfBytes = await fs.readFile(document.filePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    if (pageNumber < 1 || pageNumber > pages.length) {
      res.status(400);
      throw new Error(`Page number ${pageNumber} is out of bounds. Document has ${pages.length} pages.`);
    }

    const targetPage = pages[pageNumber - 1]; // PDF-LIB pages are 0-indexed

    // Get the actual dimensions of the PDF page at its original size (in PDF points)
    const pdfPageOriginalWidth = targetPage.getWidth();
    const pdfPageOriginalHeight = targetPage.getHeight();

    // Calculate scaling factors from frontend rendered dimensions to PDF original dimensions
    const scaleX = pdfPageOriginalWidth / pdfPageDimensions.width;
    const scaleY = pdfPageOriginalHeight / pdfPageDimensions.height;

    let finalSignatureWidth: number;
    let finalSignatureHeight: number;

    // Calculate position based on frontend coordinates and PDF scaling
    // Frontend signaturePosition.x/y are top-left of the draggable element
    let finalX = signaturePosition.x * scaleX;
    let finalY: number; // Will be calculated based on type

    if (signatureType === 'text') {
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica); // Or another font like TimesRoman
      const fontSize = 24; // Default font size for text signatures on PDF
      const textWidth = font.widthOfTextAtSize(signatureData, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      finalSignatureWidth = textWidth;
      finalSignatureHeight = textHeight;

      // For text, pdf-lib's drawText uses the baseline of the text.
      // Frontend Y is top of the element.
      // So, pdfY = pdfPageHeight - (frontendTopY * scaleY) - scaledTextHeight
      finalY = pdfPageOriginalHeight - (signaturePosition.y * scaleY) - finalSignatureHeight;

      targetPage.drawText(signatureData, {
        x: finalX,
        y: finalY,
        font: font,
        size: fontSize,
        color: rgb(0, 0, 0), // Black color for text signatures
      });

    } else { // 'draw' or 'upload' image signatures
      const base64ImagePart = signatureData.split(',')[1];
      const signatureImageBytes = Buffer.from(base64ImagePart, 'base64');

      let embeddedSignatureImage;
      if (signatureData.startsWith('data:image/png')) {
        embeddedSignatureImage = await pdfDoc.embedPng(signatureImageBytes);
      } else if (signatureData.startsWith('data:image/jpeg') || signatureData.startsWith('data:image/jpg')) {
        embeddedSignatureImage = await pdfDoc.embedJpg(signatureImageBytes);
      } else {
        // This should ideally be caught by initial validation, but as a safeguard
        res.status(400);
        throw new Error('Unsupported signature image format. Only PNG and JPEG are supported.');
      }

      // Frontend image display size (e.g., 150px width, auto height with max-height)
      // We need to scale the *embedded image's intrinsic dimensions* to the PDF.
      // If frontend has a fixed display width, we can use that as a reference for scaling.
      const frontendDisplayWidth = 150; // As per frontend CSS
      // Calculate frontend display height based on aspect ratio
      const frontendDisplayHeight = embeddedSignatureImage.height * (frontendDisplayWidth / embeddedSignatureImage.width);

      // Scale these frontend display dimensions to PDF units
      finalSignatureWidth = frontendDisplayWidth * scaleX;
      finalSignatureHeight = frontendDisplayHeight * scaleY;

      // PDF-lib's drawImage uses the bottom-left corner.
      // Frontend Y is top-left of the draggable element.
      // So, pdfY = pdfPageHeight - (frontendTopY * scaleY) - scaledImageHeight
      finalY = pdfPageOriginalHeight - (signaturePosition.y * scaleY) - finalSignatureHeight;

      targetPage.drawImage(embeddedSignatureImage, {
        x: finalX,
        y: finalY,
        width: finalSignatureWidth,
        height: finalSignatureHeight,
      });
    }

    // Ensure signature stays within page bounds (optional, but good practice)
    // This clamps the position to prevent drawing outside the page
    finalX = Math.max(0, Math.min(finalX, pdfPageOriginalWidth - finalSignatureWidth));
    finalY = Math.max(0, Math.min(finalY, pdfPageOriginalHeight - finalSignatureHeight));


    const modifiedPdfBytes = await pdfDoc.save();

    // Generate a new unique filename for the signed version
    const originalExt = path.extname(document.originalName);
    const baseName = path.basename(document.originalName, originalExt);
    const newFileName = `${baseName}_signed_${Date.now()}.pdf`;
    const newFilePath = path.join(SIGNED_DOCS_DIR, newFileName); // Save to signed_documents folder

    await fs.writeFile(newFilePath, modifiedPdfBytes);

    // Update document metadata in DB
    document.filePath = newFilePath; // CRITICAL: Update filePath to point to the new signed file
    document.fileName = newFileName; // Update fileName to reflect the new file
    document.status = 'signed'; // Set status to 'signed'
    document.lastSignedAt = new Date(); // Track when it was signed
    await document.save();

    res.status(200).json({
      message: 'Document signed successfully!',
      documentId: document._id,
      newStatus: document.status,
      // Provide a relative URL that the frontend can use to view the updated document
      // Assuming you have a static route for /signed_documents or view endpoint
      signedDocumentUrl: `/api/docs/view/${document._id}`,
    });

  } catch (err: any) {
    console.error('Error processing PDF signature:'.red.bold, err);
    // If the error was already set with a status by a previous 'throw new Error'
    // in this asyncHandler, it will be caught by the global error handler.
    // If it's a new error, set status to 500.
    if (res.statusCode === 200) {
      res.status(500);
    }
    throw new Error(`Failed to apply signature to PDF: ${err.message || 'Internal server error'}`);
  }
});


// @desc    Update document metadata (e.g., status)
// @route   PUT /api/docs/:id
// @access  Private
const updateDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, no user token');
  }

  const document = await Document.findById(req.params.id);

  if (document) {
    // Ensure the document belongs to the authenticated user
    if (document.user.toString() !== (req.user._id as Types.ObjectId).toString()) {
      res.status(403); // Forbidden
      throw new Error('Not authorized to update this document');
    }

    document.status = req.body.status || document.status;
    const updatedDocument = await document.save();

    res.status(200).json({
      message: 'Document updated successfully',
      document: {
        _id: updatedDocument._id,
        originalName: updatedDocument.originalName,
        status: updatedDocument.status,
      },
    });
  } else {
    res.status(404);
    throw new Error('Document not found');
  }
});


// IMPORTANT: Export all functions that will be used in your routes
export {
  applySignature, deleteDocument, getDocumentById, getMyDocuments, // Ensure applySignature is exported
  updateDocument, uploadDocument, viewDocument
};
