import { Repository } from "../models/Repository.js";
import {
  parseGitHubUrl,
  getDefaultBranch,
  fetchRepoTree,
  fetchFilesInBatches,
} from "./github.service.js";
import { shouldProcessFile } from "../utils/fileFilter.js";
import { chunkFiles, CodeChunk } from "../utils/codeChunker.js";
import { embedTexts } from "./embedding.service.js";
import { upsertChunks, deleteByRepository } from "./vector.service.js";
import { AppError } from "../middleware/errorHandler.js";

const MAX_FILES = 500;

export async function ingestRepository(repoUrl: string, userId: string): Promise<string> {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  const existing = await Repository.findOne({ userId, owner, name: repo });
  if (existing) {
    if (existing.status === "processing") {
      throw new AppError("Repository is already being indexed", 409);
    }
    if (existing.status === "completed") {
      existing.status = "processing";
      existing.filesProcessed = 0;
      existing.chunksCreated = 0;
      existing.error = undefined;
      await existing.save();
      await deleteByRepository(existing._id.toString());
      processRepository(existing._id.toString(), owner, repo).catch(
        (err) => handleIngestionError(existing._id.toString(), err)
      );
      return existing._id.toString();
    }
    existing.status = "processing";
    existing.error = undefined;
    await existing.save();
    processRepository(existing._id.toString(), owner, repo).catch(
      (err) => handleIngestionError(existing._id.toString(), err)
    );
    return existing._id.toString();
  }

  const repository = await Repository.create({
    userId,
    repoUrl,
    owner,
    name: repo,
    status: "processing",
  });

  processRepository(repository._id.toString(), owner, repo).catch((err) =>
    handleIngestionError(repository._id.toString(), err)
  );

  return repository._id.toString();
}

async function processRepository(
  repositoryId: string,
  owner: string,
  repo: string
): Promise<void> {
  console.log(`⏳ Starting ingestion: ${owner}/${repo}`);

  const branch = await getDefaultBranch(owner, repo);
  await Repository.findByIdAndUpdate(repositoryId, { branch });

  const tree = await fetchRepoTree(owner, repo, branch);

  const relevantFiles = tree.filter((item) =>
    shouldProcessFile(item.path, item.size)
  );

  if (relevantFiles.length === 0) {
    await Repository.findByIdAndUpdate(repositoryId, {
      status: "completed",
      filesProcessed: 0,
      chunksCreated: 0,
      fileTree: [],
    });
    console.log(`✓ No relevant files found in ${owner}/${repo}`);
    return;
  }

  if (relevantFiles.length > MAX_FILES) {
    throw new AppError(
      `Repository is too large (${relevantFiles.length} files). Maximum is ${MAX_FILES} files.`,
      422
    );
  }

  console.log(
    `  Found ${relevantFiles.length} relevant files (filtered from ${tree.length})`
  );

  const fileTree = relevantFiles.map((f) => f.path);
  await Repository.findByIdAndUpdate(repositoryId, { fileTree });

  const filePaths = relevantFiles.map((f) => f.path);
  const fileContents = await fetchFilesInBatches(
    owner,
    repo,
    filePaths,
    branch
  );

  console.log(`  Fetched ${fileContents.length} files`);

  const chunks: CodeChunk[] = await chunkFiles(
    fileContents.map((f) => ({ path: f.path, content: f.content })),
    repositoryId
  );

  console.log(`  Created ${chunks.length} chunks`);

  if (chunks.length === 0) {
    await Repository.findByIdAndUpdate(repositoryId, {
      status: "completed",
      filesProcessed: fileContents.length,
      chunksCreated: 0,
    });
    return;
  }

  console.log(`  Generating embeddings...`);
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedTexts(texts);

  console.log(`  Storing in Qdrant...`);
  await upsertChunks(chunks, embeddings);

  await Repository.findByIdAndUpdate(repositoryId, {
    status: "completed",
    filesProcessed: fileContents.length,
    chunksCreated: chunks.length,
  });

  console.log(
    `✓ Ingestion complete: ${owner}/${repo} — ${fileContents.length} files, ${chunks.length} chunks`
  );
}

async function handleIngestionError(
  repositoryId: string,
  error: any
): Promise<void> {
  const message =
    error instanceof AppError
      ? error.message
      : error?.message || "An unexpected error occurred during ingestion";

  console.error(`✗ Ingestion failed for ${repositoryId}:`, error);

  try {
    await Repository.findByIdAndUpdate(repositoryId, {
      status: "failed",
      error: message,
    });
  } catch (dbError) {
    console.error("Failed to update repository status:", dbError);
  }
}
