import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/User";

dotenv.config();

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = "Admin User";

async function createAdmin() {
  const mongoUri = process.env.MONGO_URI?.trim();


  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in server/.env");
  }
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD is missing in server/.env");
  }

  await mongoose.connect(mongoUri);

  try {
    const existingUser = await User.findOne({ email }).select("+passwordHash");

    if (existingUser) {
      existingUser.name = name;
      existingUser.role = "admin";
      existingUser.isDeleted = false;
      existingUser.passwordHash = password;
      existingUser.refreshTokens = [];
      await existingUser.save();

      console.log(`Updated existing user as admin: ${email}`);
      return;
    }

    await User.create({
      name,
      email,
      passwordHash: password,
      role: "admin",
    });

    console.log(`Created admin user: ${email}`);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin().catch((error) => {
  console.error("Failed to create admin:", error);
  process.exit(1);
});
