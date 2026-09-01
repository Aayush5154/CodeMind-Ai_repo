import express from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { errorHandler, AppError } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.routes.js";
import { repositoryRoutes } from "./routes/repository.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";

const app = express();

// Render terminates TLS at its proxy; without this the client IP seen by the
// rate limiter is the proxy's and req.secure is always false.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
app.use(compression());

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Same-origin and non-browser callers (health checks, curl) send no Origin.
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/$/, "");

    if (!env.isProduction) return callback(null, true);
    if (env.CORS_ORIGINS.includes(normalized)) return callback(null, true);

    callback(new AppError(`Origin ${origin} is not allowed`, 403));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down and try again shortly.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
});

// Indexing and chat each burn provider quota, so they are capped well below the
// general API allowance.
const expensiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "You have reached the hourly limit for AI requests. Please try again later.",
  },
});

app.get("/api/health", (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    status: dbConnected ? "ok" : "degraded",
    database: dbConnected ? "connected" : "disconnected",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/repositories", authenticate, expensiveLimiter, repositoryRoutes);
app.use("/api/chat", authenticate, expensiveLimiter, chatRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "Endpoint not found" });
});

app.use(errorHandler);

export default app;
