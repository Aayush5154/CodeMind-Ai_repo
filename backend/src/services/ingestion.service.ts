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

/** Maximum number of files to process in a single repository */
const MAX_FILES = 500;

/**
 * Orchestrates the full repository ingestion pipeline:
 * 1. Validate URL & extract owner/repo
 * 2. Fetch repository tree
 * 3. Filter relevant files
 * 4. Fetch file contents (batched)
 * 5. Chunk code with metadata
 * 6. Generate embeddings
 * 7. Store in Qdrant
 *
 * Runs asynchronously — updates repository status in MongoDB as it progresses.
 */
export async function ingestRepository(repoUrl: string): Promise<string> {
  // Step 1: Parse and validate
  const { owner, repo } = parseGitHubUrl(repoUrl);

  // Check if already indexed or in progress
  const existing = await Repository.findOne({ owner, name: repo });
  if (existing) {
    if (existing.status === "processing") {
      throw new AppError("Repository is already being indexed", 409);
    }
    if (existing.status === "completed") {
      // Re-index: reset status and clear old vectors
      existing.status = "processing";
      existing.filesProcessed = 0;
      existing.chunksCreated = 0;
      existing.error = undefined;
      await existing.save();
      // Delete old vectors
      await deleteByRepository(existing._id.toString());
      // Continue with re-indexing
      processRepository(existing._id.toString(), owner, repo).catch(
        (err) => handleIngestionError(existing._id.toString(), err)
      );
      return existing._id.toString();
    }
    // If failed, retry
    existing.status = "processing";
    existing.error = undefined;
    await existing.save();
    processRepository(existing._id.toString(), owner, repo).catch(
      (err) => handleIngestionError(existing._id.toString(), err)
    );
    return existing._id.toString();
  }

  // Create new repository record
  const repository = await Repository.create({
    repoUrl,
    owner,
    name: repo,
    status: "processing",
  });

  // Process in background
  processRepository(repository._id.toString(), owner, repo).catch((err) =>
    handleIngestionError(repository._id.toString(), err)
  );

  return repository._id.toString();
}

/**
 * Background processing pipeline for a repository.
 */
async function processRepository(
  repositoryId: string,
  owner: string,
  repo: string
): Promise<void> {
  console.log(`⏳ Starting ingestion: ${owner}/${repo}`);

  // Step 2: Get default branch
  const branch = await getDefaultBranch(owner, repo);
  await Repository.findByIdAndUpdate(repositoryId, { branch });

  // Step 3: Fetch the full file tree
  const tree = await fetchRepoTree(owner, repo, branch);

  // Step 4: Filter relevant files
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

  // Check file limit
  if (relevantFiles.length > MAX_FILES) {
    throw new AppError(
      `Repository is too large (${relevantFiles.length} files). Maximum is ${MAX_FILES} files for MVP.`,
      422
    );
  }

  console.log(
    `  Found ${relevantFiles.length} relevant files (filtered from ${tree.length})`
  );

  // Save file tree for the frontend file explorer
  const fileTree = relevantFiles.map((f) => f.path);
  await Repository.findByIdAndUpdate(repositoryId, { fileTree });

  // Step 5: Fetch file contents
  const filePaths = relevantFiles.map((f) => f.path);
  const fileContents = await fetchFilesInBatches(
    owner,
    repo,
    filePaths,
    branch
  );

  console.log(`  Fetched ${fileContents.length} files`);

  // Step 6: Chunk all files
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

  // Step 7: Generate embeddings
  console.log(`  Generating embeddings...`);
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedTexts(texts);

  // Step 8: Store in Qdrant
  console.log(`  Storing in Qdrant...`);
  await upsertChunks(chunks, embeddings);

  // Step 9: Update status to completed
  await Repository.findByIdAndUpdate(repositoryId, {
    status: "completed",
    filesProcessed: fileContents.length,
    chunksCreated: chunks.length,
  });

  console.log(
    `✓ Ingestion complete: ${owner}/${repo} — ${fileContents.length} files, ${chunks.length} chunks`
  );
}

/**
 * Handles errors during the ingestion pipeline by updating the repository status.
 */
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
