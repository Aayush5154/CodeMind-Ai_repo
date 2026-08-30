import { Request, Response, NextFunction } from "express";
import { ChatSession } from "../models/ChatSession.js";
import { Message, ISource } from "../models/Message.js";
import { Repository } from "../models/Repository.js";
import { retrieveContext } from "../services/retrieval.service.js";
import { generateAnswer, ChatHistoryMessage } from "../services/llm.service.js";
import { AppError } from "../middleware/errorHandler.js";

export async function createSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { repositoryId } = req.body;

    if (!repositoryId) {
      throw new AppError("Repository ID is required", 400);
    }

    const repository = await Repository.findOne({ _id: repositoryId, userId: req.user!._id });
    if (!repository) {
      throw new AppError("Repository not found", 404);
    }
    if (repository.status !== "completed") {
      throw new AppError("Repository is not yet indexed", 400);
    }

    const session = await ChatSession.create({ repositoryId });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session._id,
        repositoryId: session.repositoryId,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function askQuestion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { repositoryId, sessionId, question } = req.body;

    if (!repositoryId || !question) {
      throw new AppError("Repository ID and question are required", 400);
    }

    const repository = await Repository.findOne({ _id: repositoryId, userId: req.user!._id });
    if (!repository) {
      throw new AppError("Repository not found", 404);
    }
    if (repository.status !== "completed") {
      throw new AppError("Repository is not yet indexed", 400);
    }

    let session;
    if (sessionId) {
      session = await ChatSession.findById(sessionId);
      if (!session) {
        throw new AppError("Chat session not found", 404);
      }
    } else {
      session = await ChatSession.create({ repositoryId });
    }

    await Message.create({
      sessionId: session._id,
      role: "user",
      content: question,
      sources: [],
    });

    const recentMessages = await Message.find({ sessionId: session._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const chatHistory: ChatHistoryMessage[] = recentMessages
      .reverse()
      .slice(0, -1)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const { context, sources } = await retrieveContext(
      question,
      repositoryId
    );

    const answer = await generateAnswer(question, context, chatHistory);

    const assistantMessage = await Message.create({
      sessionId: session._id,
      role: "assistant",
      content: answer,
      sources: sources as ISource[],
    });

    res.json({
      success: true,
      data: {
        answer,
        sources,
        sessionId: session._id,
        messageId: assistantMessage._id,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getChatHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const session = await ChatSession.findById(id);
    if (!session) {
      throw new AppError("Chat session not found", 404);
    }

    const messages = await Message.find({ sessionId: id })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
}
