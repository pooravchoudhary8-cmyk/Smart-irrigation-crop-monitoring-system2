import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/smart_irrigation"
    );


    console.log("MongoDB connected");
  } catch (error) {
    console.error("⚠️ MongoDB connection failed:", error.message);
    console.warn("⚠️ Server will continue running without MongoDB. Some features may be unavailable.");
  }
};

export default connectDB;
