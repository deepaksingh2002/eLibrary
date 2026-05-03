import mongoose from "mongoose";

mongoose.connection.on("disconnected", () => {
  console.error("[DB] MongoDB disconnected. Attempting reconnect...");
});

mongoose.connection.on("reconnected", () => {
  console.info("[DB] MongoDB reconnected successfully");
});

mongoose.connection.on("error", (err) => {
  console.error("[DB] MongoDB connection error:", err);
});

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI?.trim();

    if (!mongoUri) {
      throw new Error('MONGO_URI is missing. Set it in server/.env using a value that starts with "mongodb://" or "mongodb+srv://".');
    }

    if (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) {
      throw new Error('Invalid MONGO_URI. It must start with "mongodb://" or "mongodb+srv://".');
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });
    console.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};
