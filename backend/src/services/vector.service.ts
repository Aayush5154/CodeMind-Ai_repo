import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
import { CodeChunk } from "../utils/codeChunker.js";

const COLLECTION_NAME = "codebase_chunks";
const VECTOR_SIZE = 3072; // gemini-embedding-001 dimension

let client: QdrantClient | null = null;

/**
 * Returns a singleton Qdrant client.
 */
function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: env.QDRANT_URL,
      ...(env.QDRANT_API_KEY ? { apiKey: env.QDRANT_API_KEY } : {}),
    });
  }
  return client;
}

/**
 * Ensures the codebase_chunks collection exists in Qdrant.
 * Creates it with Cosine distance if it doesn't exist.
 */
export async function ensureCollection(): Promise<void> {
  const qdrant = getClient();

  try {
    const { exists } = await qdrant.collectionExists(COLLECTION_NAME);
    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      await createPayloadIndexes(qdrant);
      console.log(`✓ Created Qdrant collection: ${COLLECTION_NAME}`);
    } else {
      // Guard against a collection created with a different vector size
      // (e.g. leftover from a different embedding model) — recreate it.
      const info = await qdrant.getCollection(COLLECTION_NAME);
      const config = info.config?.params?.vectors as
        | { size?: number }
        | undefined;
      if (config && typeof config.size === "number" && config.size !== VECTOR_SIZE) {
        console.warn(
          `  Vector size mismatch: collection has ${config.size}, expected ${VECTOR_SIZE}. Recreating...`
        );
        await qdrant.deleteCollection(COLLECTION_NAME);
        await qdrant.createCollection(COLLECTION_NAME, {
          vectors: {
            size: VECTOR_SIZE,
            distance: "Cosine",
          },
        });
        await createPayloadIndexes(qdrant);
        console.log(`✓ Recreated Qdrant collection: ${COLLECTION_NAME}`);
      } else {
        // Ensure indexes exist on existing collection (idempotent)
        await createPayloadIndexes(qdrant);
      }
    }
  } catch (error) {
    console.error("Failed to ensure Qdrant collection:", error);
    throw error;
  }
}

/**
 * Creates payload indexes required for filtering.
 * Qdrant needs a keyword index on repositoryId to use it in query filters.
 */
async function createPayloadIndexes(qdrant: QdrantClient): Promise<void> {
  try {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "repositoryId",
      field_schema: "keyword",
      wait: true,
    });
  } catch (error: any) {
    // Ignore "already exists" errors
    if (!error.message?.includes("already exists")) {
      console.warn("Failed to create payload index:", error.message);
    }
  }
}

/**
 * Upserts code chunks with their embeddings into Qdrant.
 * Processes in batches of 100 points.
 */
export async function upsertChunks(
  chunks: CodeChunk[],
  embeddings: number[][]
): Promise<void> {
  const qdrant = getClient();
  await ensureCollection();

  const BATCH_SIZE = 100;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batchChunks = chunks.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

    const points = batchChunks
      .map((chunk, idx) => ({
        id: uuidv4(),
        vector: batchEmbeddings[idx],
        payload: {
          repositoryId: chunk.metadata.repositoryId,
          filePath: chunk.metadata.filePath,
          language: chunk.metadata.language,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
          chunkIndex: chunk.metadata.chunkIndex,
          content: chunk.content,
        },
      }))
      .filter((point) => point.vector && point.vector.length > 0);

    if (points.length === 0) {
      console.warn(`  ⚠ Skipping batch — all ${batchChunks.length} embeddings were empty`);
      continue;
    }

    if (points.length < batchChunks.length) {
      console.warn(
        `  ⚠ Skipped ${batchChunks.length - points.length} chunks with empty embeddings`
      );
    }

    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    });
  }
}

export interface SearchResult {
  content: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  score: number;
}

/**
 * Searches Qdrant for code chunks similar to the query vector,
 * filtered by repository ID.
 */
export async function searchSimilar(
  queryVector: number[],
  repositoryId: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const qdrant = getClient();

  const results = await qdrant.query(COLLECTION_NAME, {
    query: queryVector,
    filter: {
      must: [
        {
          key: "repositoryId",
          match: { value: repositoryId },
        },
      ],
    },
    with_payload: true,
    limit: topK,
  });

  return results.points.map((point: any) => ({
    content: point.payload?.content || "",
    filePath: point.payload?.filePath || "",
    language: point.payload?.language || "",
    startLine: point.payload?.startLine || 0,
    endLine: point.payload?.endLine || 0,
    score: point.score || 0,
  }));
}

/**
 * Deletes all vectors for a specific repository from Qdrant.
 * Used for re-indexing.
 */
export async function deleteByRepository(
  repositoryId: string
): Promise<void> {
  const qdrant = getClient();

  await qdrant.delete(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: "repositoryId",
          match: { value: repositoryId },
        },
      ],
    },
  });
}
