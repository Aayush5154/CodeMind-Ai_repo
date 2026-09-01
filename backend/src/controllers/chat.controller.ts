import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ChatSession } from "../models/ChatSession.js";
import { Message, ISource } from "../models/Message.js";
import { Repository, type IRepository } from "../models/Repository.js";
import { retrieveContext } from "../services/retrieval.service.js";
import { generateAnswer, ChatHistoryMessage } from "../services/llm.service.js";
import { AppError } from "../middleware/errorHandler.js";

const MAX_QUESTION_LENGTH = 2000;
const HISTORY_WINDOW = 10;

async function findOwnedRepository(
  repositoryId: unknown,
  userId: mongoose.Types.ObjectId
): Promise<IRepository> {
  if (
    typeof repositoryId !== "string" ||
    !mongoose.isValidObjectId(repositoryId)
  ) {
    throw new AppError("A valid repository ID is required", 400);
  }

  const repository = await Repository.findOne({ _id: repositoryId, userId });
  if (!repository) {
    throw new AppError("Repository not found", 404);
  }
  if (repository.status !== "completed") {
    throw new AppError(
      repository.status === "failed"
        ? `This repository failed to index: ${repository.error ?? "unknown error"}`
        : "This repository is still being indexed. Please wait for it to finish.",
      409
    );
  }

  return repository;
}

export async function createSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const repository = await findOwnedRepository(
      req.body?.repositoryId,
      req.user!._id as mongoose.Types.ObjectId
    );

    const session = await ChatSession.create({
      repositoryId: repository._id,
      userId: req.user!._id,
    });

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
    const { repositoryId, sessionId, question } = req.body ?? {};
    const userId = req.user!._id as mongoose.Types.ObjectId;

    if (typeof question !== "string" || !question.trim()) {
      throw new AppError("A question is required", 400);
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new AppError(
        `Question is too long (max ${MAX_QUESTION_LENGTH} characters)`,
        400
      );
    }

    const repository = await findOwnedRepository(repositoryId, userId);

    let session;
    if (sessionId !== undefined && sessionId !== null && sessionId !== "") {
      if (!mongoose.isValidObjectId(sessionId)) {
        throw new AppError("Invalid session ID", 400);
      }
      // Scoping by userId prevents reading or appending to another user's session.
      session = await ChatSession.findOne({ _id: sessionId, userId });
      if (!session) {
        throw new AppError("Chat session not found", 404);
      }
      if (session.repositoryId.toString() !== repository._id.toString()) {
        throw new AppError(
          "This chat session belongs to a different repository",
          400
        );
      }
    } else {
      session = await ChatSession.create({
        repositoryId: repository._id,
        userId,
      });
    }

    const trimmedQuestion = question.trim();

    // History is read before the new question is stored so the current turn is
    // not duplicated into the prompt.
    const priorMessages = await Message.find({ sessionId: session._id })
      .sort({ createdAt: -1 })
      .limit(HISTORY_WINDOW)
      .lean();

    const chatHistory: ChatHistoryMessage[] = priorMessages
      .reverse()
      .map((msg) => ({ role: msg.role, content: msg.content }));

    await Message.create({
      sessionId: session._id,
      role: "user",
      content: trimmedQuestion,
      sources: [],
    });

    const { context, sources } = await retrieveContext(
      trimmedQuestion,
      repository._id.toString()
    );

    const answer = await generateAnswer(trimmedQuestion, context, chatHistory);

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

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid session ID", 400);
    }

    const session = await ChatSession.findOne({
      _id: id,
      userId: req.user!._id,
    });
    if (!session) {
      throw new AppError("Chat session not found", 404);
    }

    const messages = await Message.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .lean();

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
}
