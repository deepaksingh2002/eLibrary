import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "user" | "guest";
  avatar?: string;
  avatarPublicId?: string;
  preferences: {
    genres: string[];
    language: string;
  };
  monthlyGoal: number;
  streak: number;
  longestStreak: number;
  lastActiveDate?: Date;
  totalBooksRead: number;
  totalMinutesRead: number;
  refreshTokens: string[];
  isDeleted: boolean;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  comparePassword(plain: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "user", "guest"], default: "user" },
  avatar: { type: String },
  avatarPublicId: { type: String },
  preferences: {
    genres: [{ type: String }],
    language: { type: String, default: "en" },
  },
  monthlyGoal: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActiveDate: { type: Date },
  totalBooksRead: { type: Number, default: 0 },
  totalMinutesRead: { type: Number, default: 0 },
  refreshTokens: { type: [String], default: [] },
  isDeleted: { type: Boolean, default: false },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastActiveDate: -1 });
userSchema.index({ streak: -1 });
userSchema.index({ passwordResetToken: 1 }, { sparse: true });

userSchema.pre("save", async function(next) {
  if (!this.isModified("passwordHash")) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  next();
});

userSchema.methods.comparePassword = async function(plain: string): Promise<boolean> {
  return await bcrypt.compare(plain, this.passwordHash);
};

const User = mongoose.model<IUser>("User", userSchema);

export { User };
export default User;
