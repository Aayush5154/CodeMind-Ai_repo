import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.routes.js";
import { repositoryRoutes } from "./routes/repository.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "CodeMind API is running" });
});

app.use("/api/auth", authRoutes);

app.use("/api/repositories", authenticate, repositoryRoutes);
app.use("/api/chat", authenticate, chatRoutes);

app.use(errorHandler);

export default app;
