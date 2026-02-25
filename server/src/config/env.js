const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const required = ["PORT", "MONGODB_URI", "JWT_SECRET", "OPENAI_API_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  openAiEmbeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large",
  googleApplicationCredentials:
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY || "",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100),
};
