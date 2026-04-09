const mongoose = require("mongoose");

const connectDB = async () => {
  const MONGO_URL = process.env.MONGO_URL;
  // Guard: missing env var
  if (!MONGO_URL) {
    throw new Error("MONGO_URL is not defined in environment variables");
  }

  try {
    const connect = await mongoose.connect(MONGO_URL, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log(`MongoDB Connected: ${connect.connection.host}`);

    // ── Index reconciliation ────────────────────────────────────────────────
    // The emailId_1 index may exist without sparse:true from an older schema.
    // syncIndexes() alone may not detect option-only differences, so we
    // explicitly drop the stale index first, then let Mongoose recreate it
    // correctly as { unique: true, sparse: true }.
    try {
      const User = require("../models/User.model");
      await User.collection.dropIndex("emailId_1").catch(() => {
        // Index doesn't exist — nothing to drop, that's fine.
      });
      await User.syncIndexes();
      console.log("User indexes synced.");
    } catch (indexErr) {
      console.warn("User index sync warning (non-fatal):", indexErr.message);
    }

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
