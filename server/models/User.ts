import bcrypt from 'bcryptjs';
import mongoose, { Document, Schema } from 'mongoose';

// Define an interface for the User document, extending mongoose.Document
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>; // Method to compare passwords
}

const userSchema: Schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/.+@.+\..+/, 'Please use a valid email address'], // Basic email regex validation
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// Mongoose pre-save hook to hash the password before saving a user
userSchema.pre<IUser>('save', async function (next) {
  // Only hash the password if it's new or has been modified
  if (!this.isModified('password')) {
    return next();
  }

  // Generate a salt for hashing (10 rounds for strong hashing)
  const salt = await bcrypt.genSalt(10);
  // Hash the user's password with the generated salt
  this.password = await bcrypt.hash(this.password, salt);
  next(); // Proceed to save the user
});

// Method attached to the userSchema for comparing entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;