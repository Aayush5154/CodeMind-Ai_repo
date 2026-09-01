import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// __dirname is backend/src/config in dev and backend/dist/config after build, so
// both resolve to the backend root; the repo root is checked as a fallback. On
// Render nothing is found and the platform's own environment variables are used.
for (const candidate of [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
]) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

export type NodeEnv = "development" | "production" | "test";

interface EnvConfig {
  NODE_ENV: NodeEnv;
  isProduction: boolean;
  PORT: number;
  MONGODB_URI: string;
  QDRANT_URL: string;
  QDRANT_API_KEY: string;
  LLM_PROVIDER: string;
  LLM_API_KEY: string;
  LLM_MODEL: string;
  EMBEDDING_MODEL: string;
  EMBEDDING_DIMENSIONS: number;
  EMBEDDING_REQUESTS_PER_MINUTE: number;
  EMBEDDING_BATCH_SIZE: number;
  GITHUB_TOKEN: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGINS: string[];
  MAX_REPO_FILES: number;
}

const errors: string[] = [];

function readString(key: string, fallback?: string): string {
  const value = process.env[key]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  errors.push(`Missing required environment variable: ${key}`);
  return "";
}

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors.push(`${key} must be a positive number (received "${raw}")`);
    return fallback;
  }
  return parsed;
}

const NODE_ENV = (process.env.NODE_ENV?.trim() || "development") as NodeEnv;
const isProduction = NODE_ENV === "production";

const JWT_SECRET = readString(
  "JWT_SECRET",
  isProduction ? undefined : "dev_only_insecure_jwt_secret"
);

if (isProduction && JWT_SECRET.length > 0 && JWT_SECRET.length < 32) {
  errors.push(
    "JWT_SECRET must be at least 32 characters in production. Generate one with: openssl rand -hex 32"
  );
}

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (isProduction && CORS_ORIGINS.length === 0) {
  errors.push(
    "CORS_ORIGINS is required in production. Set it to your frontend origin, e.g. https://codemind-web.onrender.com"
  );
}

export const env: EnvConfig = {
  NODE_ENV,
  isProduction,
  PORT: readNumber("PORT", 5000),
  MONGODB_URI: readString("MONGODB_URI"),
  QDRANT_URL: readString("QDRANT_URL"),
  QDRANT_API_KEY: readString("QDRANT_API_KEY", ""),
  LLM_PROVIDER: readString("LLM_PROVIDER", "gemini"),
  LLM_API_KEY: readString("LLM_API_KEY"),
  LLM_MODEL: readString("LLM_MODEL", "gemini-2.5-flash"),
  EMBEDDING_MODEL: readString("EMBEDDING_MODEL", "gemini-embedding-001"),
  EMBEDDING_DIMENSIONS: readNumber("EMBEDDING_DIMENSIONS", 3072),
  EMBEDDING_REQUESTS_PER_MINUTE: readNumber("EMBEDDING_REQUESTS_PER_MINUTE", 90),
  EMBEDDING_BATCH_SIZE: readNumber("EMBEDDING_BATCH_SIZE", 20),
  GITHUB_TOKEN: readString("GITHUB_TOKEN", ""),
  JWT_SECRET,
  JWT_EXPIRES_IN: readString("JWT_EXPIRES_IN", "7d"),
  CORS_ORIGINS,
  MAX_REPO_FILES: readNumber("MAX_REPO_FILES", 500),
};

if (errors.length > 0) {
  console.error("✗ Invalid environment configuration:");
  for (const message of errors) {
    console.error(`  • ${message}`);
  }
  process.exit(1);
}
