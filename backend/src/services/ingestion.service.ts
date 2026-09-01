import { Repository } from "../models/Repository.js";
import {
  parseGitHubUrl,
  getDefaultBranch,
  fetchRepoTree,
  fetchFilesInBatches,
} from "./github.service.js";
import { shouldProcessFile } from "../utils/fileFilter.js";
import { chunkFiles, CodeChunk } from "../utils/codeChunker.js";
import { embedDocuments } from "./embedding.service.js";
import { upsertChunks, deleteByRepository } from "./vector.service.js";
import { AppError } from "../middleware/errorHandler.js";
import { env } from "../config/env.js";

/**
 * Ingestion runs in-process after the HTTP response is sent. A cap keeps a burst
 * of requests from exhausting the API quota and memory of a single instance.
 */
const MAX_CONCURRENT_INGESTIONS = 2;
const STALE_PROCESSING_MS = 30 * 60 * 1000;

const inFlight = new Set<string>();

export async function ingestRepository(
  repoUrl: string,
  userId: string
): Promise<string> {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  const existing = await Repository.findOne({ userId, owner, name: repo });

  if (existing) {
    const id = existing._id.toString();

    if (existing.status === "processing" && inFlight.has(id)) {
      throw new AppError("Repository is already being indexed", 409);
    }

    if (inFlight.size >= MAX_CONCURRENT_INGESTIONS) {
      throw new AppError(
        "The server is indexing other repositories right now. Please try again in a few minutes.",
        503
      );
    }

    existing.status = "processing";
    existing.filesProcessed = 0;
    existing.chunksCreated = 0;
    existing.chunksIndexed = 0;
    existing.error = undefined;
    await existing.save();

    await deleteByRepository(id);
    launch(id, owner, repo);
    return id;
  }

  if (inFlight.size >= MAX_CONCURRENT_INGESTIONS) {
    throw new AppError(
      "The server is indexing other repositories right now. Please try again in a few minutes.",
      503
    );
  }

  const repository = await Repository.create({
    userId,
    repoUrl,
    owner,
    name: repo,
    status: "processing",
  });

  const id = repository._id.toString();
  launch(id, owner, repo);
  return id;
}

function launch(repositoryId: string, owner: string, repo: string): void {
  inFlight.add(repositoryId);

  processRepository(repositoryId, owner, repo)
    .catch((err) => handleIngestionError(repositoryId, err))
    .finally(() => inFlight.delete(repositoryId));
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
      status: "failed",
      error:
        "No supported source files were found in this repository. Nothing could be indexed.",
      fileTree: [],
    });
    console.log(`✗ No relevant files found in ${owner}/${repo}`);
    return;
  }

  if (relevantFiles.length > env.MAX_REPO_FILES) {
    throw new AppError(
      `Repository is too large (${relevantFiles.length} indexable files). The limit is ${env.MAX_REPO_FILES}.`,
      422
    );
  }

  console.log(
    `  Found ${relevantFiles.length} relevant files (filtered from ${tree.length})`
  );

  const filePaths = relevantFiles.map((f) => f.path);
  await Repository.findByIdAndUpdate(repositoryId, { fileTree: filePaths });

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
      status: "failed",
      error: "Repository files produced no indexable content.",
      filesProcessed: fileContents.length,
      chunksCreated: 0,
      chunksIndexed: 0,
    });
    return;
  }

  console.log(`  Generating embeddings for ${chunks.length} chunks...`);
  const embeddings = await embedDocuments(chunks.map((c) => c.content));

  console.log(`  Storing in Qdrant...`);
  const indexed = await upsertChunks(chunks, embeddings);

  if (indexed === 0) {
    throw new Error(
      "No vectors could be stored — every chunk failed to embed. The repository was not indexed."
    );
  }

  const skipped = chunks.length - indexed;

  await Repository.findByIdAndUpdate(repositoryId, {
    status: "completed",
    filesProcessed: fileContents.length,
    chunksCreated: chunks.length,
    chunksIndexed: indexed,
    ...(skipped > 0
      ? {
          error: `${skipped} of ${chunks.length} chunks were empty and skipped. Answers may be incomplete.`,
        }
      : {}),
  });

  console.log(
    `✓ Ingestion complete: ${owner}/${repo} — ${fileContents.length} files, ${indexed}/${chunks.length} chunks indexed`
  );
}

async function handleIngestionError(
  repositoryId: string,
  error: unknown
): Promise<void> {
  const message =
    error instanceof AppError
      ? error.message
      : (error as Error)?.message ||
        "An unexpected error occurred during ingestion";

  console.error(`✗ Ingestion failed for ${repositoryId}: ${message}`);

  try {
    await Repository.findByIdAndUpdate(repositoryId, {
      status: "failed",
      error: message.slice(0, 1000),
    });
  } catch (dbError) {
    console.error("Failed to update repository status:", dbError);
  }
}

/**
 * A restart or crash leaves in-process ingestions orphaned in "processing", where
 * they would block re-indexing forever. Failing them at boot makes them retryable.
 */
export async function recoverStuckIngestions(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);

  const result = await Repository.updateMany(
    { status: "processing", updatedAt: { $lt: cutoff } },
    {
      status: "failed",
      error: "Indexing was interrupted by a server restart. Please try again.",
    }
  );

  if (result.modifiedCount > 0) {
    console.log(`  Reset ${result.modifiedCount} stalled ingestion(s)`);
  }
}
