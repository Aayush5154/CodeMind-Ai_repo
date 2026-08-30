import { Request, Response, NextFunction } from "express";
import { Repository } from "../models/Repository.js";
import { ingestRepository } from "../services/ingestion.service.js";
import { AppError } from "../middleware/errorHandler.js";

export async function indexRepository(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { repoUrl } = req.body;
    const userId = req.user!._id.toString();

    if (!repoUrl || typeof repoUrl !== "string") {
      throw new AppError("Repository URL is required", 400);
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
    const userId = req.user!._id.toString();

    const repository = await Repository.findOne({ _id: id, userId });

    if (!repository) {
      throw new AppError("Repository not found", 404);
    }

    res.json({
      success: true,
      data: {
        id: repository._id,
        repoUrl: repository.repoUrl,
        owner: repository.owner,
        name: repository.name,
        branch: repository.branch,
        status: repository.status,
        filesProcessed: repository.filesProcessed,
        chunksCreated: repository.chunksCreated,
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
    const userId = req.user!._id.toString();

    const repositories = await Repository.find({ userId })
      .sort({ createdAt: -1 })
      .select("-fileTree")
      .lean();

    res.json({
      success: true,
      data: repositories,
    });
  } catch (error) {
    next(error);
  }
}
