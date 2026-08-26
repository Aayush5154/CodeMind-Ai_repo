import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.js";
import { repositoryRoutes } from "./routes/repository.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "CodeMind API is running" });
});

// Routes
app.use("/api/repositories", repositoryRoutes);
app.use("/api/chat", chatRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
