const mongoose = require("mongoose");

const connectDB = async () => {
  // Guard: already connected
  if (mongoose.connection.readyState === 1) {
    console.log("MongoDB already connected");
    return;
  }

  const MONGO_URL = process.env.MONGO_URL;

  // Guard: missing env var
  if (!MONGO_URL) {
    throw new Error("MONGO_URL is not defined in environment variables");
  }

  try {
    const connect = await mongoose.connect(MONGO_URL, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB Connected: ${connect.connection.host}`);

    mongoose.connection.on("disconnected", () =>
      console.warn("⚠️  MongoDB disconnected"),
    );

    mongoose.connection.on("error", (err) =>
      console.error("MongoDB runtime error:", err),
    );
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

module.exports = { connectDB };
