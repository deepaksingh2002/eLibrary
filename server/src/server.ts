import dotenv from "dotenv";
dotenv.config();

import { validateEnv } from "./config/validateEnv";
validateEnv();

import { Server } from "http";
import mongoose from "mongoose";
import app from "./app";
import { connectDB } from "./config/db";
import { startRecommendationCron } from "./jobs/recommendationCron";

const PORT = Number(process.env.PORT || 5000);

let server: Server;

const startServer = async () => {
  await connectDB();
  
  server = app.listen(PORT, () => {
    console.info(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });

  startRecommendationCron();
  
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
  process.on("SIGINT",  () => shutdown("SIGINT"));
};

startServer();
