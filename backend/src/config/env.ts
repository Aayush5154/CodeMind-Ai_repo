import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface EnvConfig {
  PORT: number;
  MONGODB_URI: string;
  QDRANT_URL: string;
  QDRANT_API_KEY: string;
  LLM_PROVIDER: string;
  LLM_API_KEY: string;
  LLM_MODEL: string;
  EMBEDDING_MODEL: string;
  GITHUB_TOKEN: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || "";
}

export const env: EnvConfig = {
  PORT: parseInt(getEnvVar("PORT", false) || "5000", 10),
  MONGODB_URI: getEnvVar("MONGODB_URI"),
  QDRANT_URL: getEnvVar("QDRANT_URL"),
  QDRANT_API_KEY: getEnvVar("QDRANT_API_KEY", false),
  LLM_PROVIDER: getEnvVar("LLM_PROVIDER", false) || "gemini",
  LLM_API_KEY: getEnvVar("LLM_API_KEY"),
  LLM_MODEL: getEnvVar("LLM_MODEL", false) || "gemini-1.5-flash",
  EMBEDDING_MODEL: getEnvVar("EMBEDDING_MODEL", false) || "text-embedding-004",
  GITHUB_TOKEN: getEnvVar("GITHUB_TOKEN", false),
  JWT_SECRET: getEnvVar("JWT_SECRET", false) || "default_jwt_secret_change_me",
  JWT_EXPIRES_IN: getEnvVar("JWT_EXPIRES_IN", false) || "7d",
};
