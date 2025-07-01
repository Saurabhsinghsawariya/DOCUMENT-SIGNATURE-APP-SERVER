import asyncHandler from 'express-async-handler';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib'; // Corrected import for pdf-lib
import Document from '../models/documentModel.js';
import User from '../models/userModel.js'; // Make sure User model is imported

// Get __dirname equivalent in ES Modules (should only be declared ONCE)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Upload new document
// @route   POST /api/documents/upload
// @access  Private
const uploadDocument = asyncHandler(async (req, res) => {
  // Check if file was uploaded
  if (!req.file) {
    res.status(400);
    throw new Error('No document file uploaded');
  }

  const { originalname, filename, size, path: filePath } = req.file;

  const document = await Document.create({
    originalName: originalname,
    fileName: filename, // Stored filename on server
    filePath: filePath, // Full path on server
    size: size,
    owner: req.user._id, // User ID from protect middleware
    status: 'pending', // Initial status
  });

  res.status(201).json(document);
});

// @desc    Get all documents accessible to the user (owned or shared)
// @route   GET /api/documents
// @access  Private
const getDocuments = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Find documents owned by the user
  const documents = await Document.find({ owner: userId })
    .populate('owner', 'name email') // Populate owner details
    .populate('sharedWith.user', 'name email') // Populate sharedWith user details
    .sort({ createdAt: -1 }); // Sort by newest first

  res.json(documents);
});

// @desc    Get documents shared with the current user
// @route   GET /api/documents/shared-with-me
// @access  Private
const getSharedWithMeDocuments = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Find documents where the user is in the sharedWith array
  const documents = await Document.find({
    'sharedWith.user': userId,
    'sharedWith.permission': { $in: ['view', 'view_and_sign'] } // Ensure they have some access
  })
  .populate('owner', 'name email')
  .populate('sharedWith.user', 'name email')
  .sort({ createdAt: -1 }); // Sort by newest first

  res.json(documents);
});


// @desc    Get single document by ID
// @route   GET /api/documents/:id
// @access  Private
const getDocumentById = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id)
    .populate('owner', 'name email')
    .populate('sharedWith.user', 'name email');

  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  // Check if user is owner or has access via sharing
  const hasAccess = document.owner.equals(req.user._id) ||
    document.sharedWith.some(share => share.user.equals(req.user._id));

  if (!hasAccess) {
    res.status(403);
    throw new Error('Not authorized to view this document');
  }

  res.json(document);
});

// @desc    Get document content (PDF stream) for display
// @route   GET /api/documents/:id/content
// @access  Private
const getDocumentContent = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  // Ensure the user has access to view the document
  const hasAccess = document.owner.equals(req.user._id) ||
    document.sharedWith.some(share => share.user.equals(req.user._id));

  if (!hasAccess) {
    res.status(403);
    throw new Error('Not authorized to view this document content');
  }

  const absoluteFilePath = path.resolve(__dirname, '../../uploads', document.fileName);

  if (fs.existsSync(absoluteFilePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(absoluteFilePath);
  } else {
    res.status(404);
    throw new Error('Document file not found on server.');
  }
});


// @desc    Download a document
// @route   GET /api/documents/:id/download
// @access  Private
const downloadDocument = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  // Check if user is owner or has access via sharing
  const hasAccess = document.owner.equals(req.user._id) ||
    document.sharedWith.some(share => share.user.equals(req.user._id));

  if (!hasAccess) {
    res.status(403);
    throw new Error('Not authorized to download this document');
  }

  const absoluteFilePath = path.resolve(__dirname, '../../uploads', document.fileName);

  if (fs.existsSync(absoluteFilePath)) {
    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.download(absoluteFilePath, document.originalName, (err) => {
      if (err) {
        console.error('Error during file download:', err);
        res.status(500).send('Could not download the file.');
      }
    });
  } else {
    res.status(404);
    throw new Error('Document file not found on server.');
  }
});


// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private (Owner only)
const deleteDocument = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  // Check if the logged-in user is the owner of the document
  if (!document.owner.equals(req.user._id)) {
    res.status(403);
    throw new Error('Not authorized to delete this document');
  }

  // Delete the file from the uploads directory
  fs.unlink(document.filePath, async (err) => {
    if (err) {
      console.error(`Error deleting file from filesystem: ${err}`);
    }
    await Document.deleteOne({ _id: req.params.id });
    res.json({ message: 'Document removed' });
  });
});

// @desc    Share a document with another user
// @route   PUT /api/documents/:id/share
// @access  Private (Owner only)
const shareDocument = asyncHandler(async (req, res) => {
  const { shareWithEmail, permission } = req.body;

  const document = await Document.findById(req.params.id);

  if (!document) {
    res.status(404);
    throw new Error('Document not found');
  }

  // Only the owner can share the document
  if (!document.owner.equals(req.user._id)) {
    res.status(403);
    throw new Error('Not authorized to share this document');
  }

  // Find the user to share with
  const userToShareWith = await User.findOne({ email: shareWithEmail });

  if (!userToShareWith) {
    res.status(404);
    throw new Error('User with that email not found');
  }

  // Prevent sharing with self
  if (userToShareWith._id.equals(req.user._id)) {
    res.status(400);
    throw new Error('Cannot share a document with yourself');
  }

  // Check if already shared with this user
  const isAlreadyShared = document.sharedWith.some(
    (share) => share.user.equals(userToShareWith._id)
  );

  if (isAlreadyShared) {
    // If already shared, update permission instead of adding new entry
    document.sharedWith = document.sharedWith.map(share =>
      share.user.equals(userToShareWith._id) ? { user: userToShareWith._id, permission: permission } : share
    );
    await document.save();
    // Re-populate to send updated details
    await document.populate('owner', 'name email');
    await document.populate('sharedWith.user', 'name email');
    return res.json({ message: `Document permission updated for ${shareWithEmail}`, document });
  } else {
    // Add new share entry
    document.sharedWith.push({
      user: userToShareWith._id,
      permission: permission,
    });
    await document.save();
    // Re-populate to send updated details
    await document.populate('owner', 'name email');
    await document.populate('sharedWith.user', 'name email');
    res.json({ message: `Document shared successfully with ${shareWithEmail}`, document });
  }
});


// @desc    Apply signatures to a document
// @route   POST /api/documents/:id/sign
// @access  Private (Owner or user with 'view_and_sign' permission)
const applySignatures = asyncHandler(async (req, res) => {
  const { signature } = req.body; // Base64 data URL of the signature image

  if (!signature) {
    res.status(400);
    throw new Error('Signature data is required.');
  }

  const document = await Document.findById(req.params.id);

  if (!document) {
    res.status(404);
    throw new Error('Document not found.');
  }

  const userId = req.user._id;
  const isOwner = document.owner.equals(userId);
  const hasSignPermission = document.sharedWith.some(
    (share) => share.user.equals(userId) && share.permission === 'view_and_sign'
  );

  // Check if the user is authorized to sign (owner or has view_and_sign permission)
  if (!isOwner && !hasSignPermission) {
    res.status(403);
    throw new Error('Not authorized to sign this document.');
  }

  // For re-signing, we'll allow it but update the existing signature.

  // ✨ START REAL PDF MANIPULATION ✨
  try {
    const existingPdfBytes = fs.readFileSync(document.filePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();

    // Get the signature image bytes from the Base64 data URL
    const signatureImageBase64 = signature.split(',')[1]; // Remove "data:image/png;base64," prefix
    let signatureImage;
    if (signature.startsWith('data:image/png')) {
        signatureImage = await pdfDoc.embedPng(signatureImageBase64);
    } else if (signature.startsWith('data:image/jpeg') || signature.startsWith('data:image/jpg')) {
        signatureImage = await pdfDoc.embedJpg(signatureImageBase64);
    } else {
        res.status(400);
        throw new Error('Unsupported signature image format. Only PNG and JPEG are supported.');
    }

    // For simplicity, let's place the signature on the first page.
    const firstPage = pages[0];

    // Get page dimensions
    const { width, height } = firstPage.getSize();

    // Define signature image dimensions and position
    // ✨ CHANGED: Adjust signature dimensions for better visibility and centering ✨
    const signatureWidth = 250; // Increased width
    const signatureHeight = 125; // Increased height

    // ✨ CHANGED: Place signature in the center of the page ✨
    const xPos = (width / 2) - (signatureWidth / 2); // Center horizontally
    const yPos = (height / 2) - (signatureHeight / 2); // Center vertically


    firstPage.drawImage(signatureImage, {
      x: xPos,
      y: yPos,
      width: signatureWidth,
      height: signatureHeight,
      opacity: 0.9, // Make it less transparent for testing
    });

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(document.filePath, modifiedPdfBytes); // Overwrite the original PDF

    console.log(`Signature applied to PDF: ${document.filePath}`);

  } catch (pdfError) {
    console.error('Error applying signature to PDF:', pdfError);
    res.status(500);
    throw new Error('Failed to apply signature to the PDF document.');
  }
  // ✨ END REAL PDF MANIPULATION ✨


  // Update document status and record the signer in the database
  document.status = 'signed';

  // If re-signing, find and update the existing signature entry for this user
  const existingSignatureIndex = document.signedBy.findIndex(
    (signer) => signer.user.equals(userId)
  );

  if (existingSignatureIndex > -1) {
    // Update existing signature entry
    document.signedBy[existingSignatureIndex].signedAt = new Date();
    document.signedBy[existingSignatureIndex].signatureImage = signature; // Update the stored Base64 image
  } else {
    // Add new signature entry
    document.signedBy.push({
      user: userId,
      signedAt: new Date(),
      signatureImage: signature, // Store the base64 signature image for display/audit
    });
  }

  await document.save();

  res.status(200).json({ message: 'Document signed successfully!', document });
});


export {
    applySignatures, deleteDocument, downloadDocument, getDocumentById, getDocumentContent, getDocuments, getSharedWithMeDocuments, shareDocument, uploadDocument
};
