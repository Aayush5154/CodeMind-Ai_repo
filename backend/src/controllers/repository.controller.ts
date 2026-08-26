import { Request, Response, NextFunction } from "express";
import { Repository } from "../models/Repository.js";
import { ingestRepository } from "../services/ingestion.service.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * POST /api/repositories/index
 * Starts indexing a GitHub repository.
 */
export async function indexRepository(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl || typeof repoUrl !== "string") {
      throw new AppError("Repository URL is required", 400);
    }

    const repositoryId = await ingestRepository(repoUrl.trim());

    res.status(202).json({
      success: true,
      repositoryId,
      status: "processing",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/repositories/:id/status
 * Returns the current indexing status of a repository.
 */
export async function getRepositoryStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const repository = await Repository.findById(id);

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

/**
 * GET /api/repositories
 * Lists all indexed repositories.
 */
export async function listRepositories(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const repositories = await Repository.find()
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
