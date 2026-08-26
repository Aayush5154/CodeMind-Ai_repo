import { Router } from "express";
import {
  indexRepository,
  getRepositoryStatus,
  listRepositories,
} from "../controllers/repository.controller.js";

export const repositoryRoutes = Router();

repositoryRoutes.post("/index", indexRepository);
repositoryRoutes.get("/", listRepositories);
repositoryRoutes.get("/:id/status", getRepositoryStatus);
