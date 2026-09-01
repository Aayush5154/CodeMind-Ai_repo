import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Repository } from "../models/Repository.js";
import { ingestRepository } from "../services/ingestion.service.js";
import { AppError } from "../middleware/errorHandler.js";

const MAX_URL_LENGTH = 300;

export async function indexRepository(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { repoUrl } = req.body ?? {};
    const userId = req.user!._id.toString();

    if (typeof repoUrl !== "string" || !repoUrl.trim()) {
      throw new AppError("Repository URL is required", 400);
    }
    if (repoUrl.length > MAX_URL_LENGTH) {
      throw new AppError("Repository URL is too long", 400);
    }

    const repositoryId = await ingestRepository(repoUrl.trim(), userId);

    res.status(202).json({
      success: true,
      repositoryId,
      status: "processing",
    });
  } catch (error) {
    next(error);
  }
}

export async function getRepositoryStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid repository ID", 400);
    }

    const repository = await Repository.findOne({
      _id: id,
      userId: req.user!._id,
    });

    if (!repository) {
      throw new AppError("Repository not found", 404);
    }

    res.json({
      success: true,
      data: {
        _id: repository._id,
        id: repository._id,
        repoUrl: repository.repoUrl,
        owner: repository.owner,
        name: repository.name,
        branch: repository.branch,
        status: repository.status,
        filesProcessed: repository.filesProcessed,
        chunksCreated: repository.chunksCreated,
        chunksIndexed: repository.chunksIndexed,
        error: repository.error,
        fileTree: repository.fileTree,
        createdAt: repository.createdAt,
        updatedAt: repository.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listRepositories(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const repositories = await Repository.find({ userId: req.user!._id })
      .sort({ createdAt: -1 })
      .select("-fileTree")
      .limit(100)
      .lean();

    res.json({ success: true, data: repositories });
  } catch (error) {
    next(error);
  }
}
