import 'colors';
import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI as string);
    console.log(`MongoDB Connected: ${conn.connection.host.cyan.underline}`);
  } catch (error: any) {
    console.error(`Error: ${error.message.red.bold}`);
    process.exit(1);
  }
};

export default connectDB;