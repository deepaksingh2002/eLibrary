const REQUIRED_ENV_VARS = [
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
] as const;

const OPTIONAL_SMTP_VARS = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"] as const;

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

  const portValue = process.env.PORT?.trim();
  if (portValue) {
    const port = Number(portValue);
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error("Environment variable PORT must be a positive integer");
    }
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

  const smtpPortValue = process.env.SMTP_PORT?.trim();
  if (smtpPortValue) {
    const smtpPort = Number(smtpPortValue);
    if (!Number.isInteger(smtpPort) || smtpPort <= 0) {
      throw new Error("Environment variable SMTP_PORT must be a positive integer");
    }
  }

  const passwordResetMinutes = Number(requireEnv("PASSWORD_RESET_EXPIRES_MINUTES"));
  if (!Number.isInteger(passwordResetMinutes) || passwordResetMinutes <= 0) {
    throw new Error("Environment variable PASSWORD_RESET_EXPIRES_MINUTES must be a positive integer");
  }

  const configuredSmtpVars = OPTIONAL_SMTP_VARS.filter((name) => process.env[name]?.trim());
  if (configuredSmtpVars.length > 0 && configuredSmtpVars.length < OPTIONAL_SMTP_VARS.length) {
    throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM must be configured together");
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.warn("[Env] GEMINI_API_KEY is not configured. AI explanations will use fallback text.");
  }

  if (configuredSmtpVars.length === 0) {
    console.warn("[Env] SMTP is not configured. Email delivery will be disabled.");
  }
}
