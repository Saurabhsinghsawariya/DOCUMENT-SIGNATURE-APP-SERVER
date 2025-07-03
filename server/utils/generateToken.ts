import jwt from 'jsonwebtoken';

const generateToken = (id: string): string => {
  // Ensure JWT_SECRET environment variable is defined
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not defined.');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d', // Token expires in 30 days
  });
};

export default generateToken;