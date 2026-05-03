const REQUIRED_ENV_VARS = [
  "PORT",
  "NODE_ENV",
  "MONGO_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_ACCESS_EXPIRES",
  "JWT_REFRESH_EXPIRES",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLIENT_URL",
  "FRONTEND_URL",
  "CRON_SECRET",
  "PASSWORD_RESET_EXPIRES_MINUTES",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
] as const;

const OPTIONAL_AI_PROVIDER_VARS = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY"] as const;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function ensureValidUrl(name: string): void {
  const value = requireEnv(name);
  try {
    new URL(value);
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL`);
  }
}

export function validateEnv(): void {
  for (const varName of REQUIRED_ENV_VARS) {
    requireEnv(varName);
  }

  const mongoUri = requireEnv("MONGO_URI");
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    throw new Error("Environment variable MONGO_URI must start with mongodb:// or mongodb+srv://");
  }

  const port = Number(requireEnv("PORT"));
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Environment variable PORT must be a positive integer");
  }

  const nodeEnv = requireEnv("NODE_ENV");
  if (!["development", "production", "test"].includes(nodeEnv)) {
    throw new Error("Environment variable NODE_ENV must be development, production, or test");
  }

  if (requireEnv("JWT_ACCESS_SECRET") === requireEnv("JWT_REFRESH_SECRET")) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values");
  }

  ensureValidUrl("CLIENT_URL");
  ensureValidUrl("FRONTEND_URL");

  const smtpPort = Number(requireEnv("SMTP_PORT"));
  if (!Number.isInteger(smtpPort) || smtpPort <= 0) {
    throw new Error("Environment variable SMTP_PORT must be a positive integer");
  }

  const passwordResetMinutes = Number(requireEnv("PASSWORD_RESET_EXPIRES_MINUTES"));
  if (!Number.isInteger(passwordResetMinutes) || passwordResetMinutes <= 0) {
    throw new Error("Environment variable PASSWORD_RESET_EXPIRES_MINUTES must be a positive integer");
  }

  const hasAiProvider = OPTIONAL_AI_PROVIDER_VARS.some((name) => process.env[name]?.trim());
  if (!hasAiProvider) {
    throw new Error("One of GEMINI_API_KEY or ANTHROPIC_API_KEY must be configured");
  }
}
