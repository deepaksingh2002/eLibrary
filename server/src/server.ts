import dotenv from "dotenv";
dotenv.config();

import { validateEnv } from "./config/validateEnv";
validateEnv();

import { Server } from "http";
import mongoose from "mongoose";
import app from "./app";
import { connectDB } from "./config/db";
import { startRecommendationCron } from "./jobs/recommendationCron";
import { initAIWorker } from "./services/aiQueue";
import { validateAIConfig } from "./config/aiConfig";

const PORT = Number(process.env.PORT || 5000);

let server: Server;

const startServer = async () => {
  await connectDB();

  // Validate AI provider configuration early
  try {
    validateAIConfig();
  } catch (err) {
    console.warn("[Server] AI config validation warning:", err);
  }

  server = app.listen(PORT, () => {
    console.info(
      `[Server] Running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`,
    );
  });

  startRecommendationCron();
  // Initialize the AI worker when Redis is available; otherwise jobs run inline.
  try {
    initAIWorker();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[Server] Could not initialize AI worker:", message);
  }

  async function shutdown(signal: string) {
    console.info(`[Server] ${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      console.info("[Server] HTTP server closed");

      try {
        await mongoose.connection.close();
        console.info("[Server] MongoDB connection closed");
      } catch (err) {
        console.error("[Server] Error closing MongoDB:", err);
      }

      process.exit(0);
    });

    setTimeout(() => {
      console.error("[Server] Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();
