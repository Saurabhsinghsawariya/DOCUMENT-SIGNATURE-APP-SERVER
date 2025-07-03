// server/models/Document.ts
import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

// Define an interface for the Document document
export interface IDocument extends MongooseDocument {
  user: Types.ObjectId; // Reference to the User model (formerly userId)
  fileName: string; // Renamed from filename
  filePath: string; // Path where the file is stored on the server (will now be updated for signed docs)
  originalName: string; // Original name of the file from the user's computer
  fileType: string; // NEW: Added fileType
  fileSize: number;
  uploadDate: Date;
  // UPDATED: Added 'reviewed' to the allowed status types
  status: 'pending' | 'signed' | 'archived' | 'reviewed';
  lastSignedAt?: Date; // Optional property to track when the document was last signed
}

const documentSchema: Schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // Refers to the 'User' model
    },
    fileName: {
      type: String,
      required: true,
      trim: true, // Removes whitespace from both ends of a string
    },
    filePath: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileType: { // NEW: Added fileType field to schema
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now, // Sets the default upload date to the current time
    },
    status: { // UPDATED: Added 'reviewed' to the enum array
      type: String,
      enum: ['pending', 'signed', 'archived', 'reviewed'], // Restricts the status to these specific values
      default: 'pending',
    },
    lastSignedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically to the schema
  }
);

const Document = mongoose.model<IDocument>('Document', documentSchema);

export default Document;