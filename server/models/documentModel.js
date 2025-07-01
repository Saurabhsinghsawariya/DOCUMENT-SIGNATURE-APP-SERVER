import mongoose from 'mongoose';

const documentSchema = mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    originalName: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true, // The name of the file on the server
    },
    filePath: {
      type: String,
      required: true, // The full path to the file on the server
    },
    size: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: 'pending', // e.g., 'pending', 'signed', 'rejected'
    },
    sharedWith: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        permission: {
          type: String,
          enum: ['view', 'view_and_sign'],
          default: 'view',
        },
      },
    ],
    // NEW FIELD FOR SIGNATURES
    signedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        signedAt: {
          type: Date,
          default: Date.now,
        },
        signatureImage: { // Storing the base64 signature image
          type: String,
          // This can be used to display the signature later or for audit.
          // Actual embedding onto PDF is a separate, more complex step.
        },
      },
    ],
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

const Document = mongoose.model('Document', documentSchema);

export default Document;