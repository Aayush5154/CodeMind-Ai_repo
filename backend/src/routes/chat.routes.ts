import { Router } from "express";
import {
  askQuestion,
  createSession,
  getChatHistory,
} from "../controllers/chat.controller.js";

export const chatRoutes = Router();

chatRoutes.post("/", askQuestion);
chatRoutes.post("/sessions", createSession);
chatRoutes.get("/sessions/:id/messages", getChatHistory);
