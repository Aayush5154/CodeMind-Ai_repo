import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
import { CodeChunk } from "../utils/codeChunker.js";

const COLLECTION_NAME = "codebase_chunks";
const VECTOR_SIZE = env.EMBEDDING_DIMENSIONS;

let client: QdrantClient | null = null;
let collectionReady = false;

function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: env.QDRANT_URL,
      ...(env.QDRANT_API_KEY ? { apiKey: env.QDRANT_API_KEY } : {}),
      checkCompatibility: false,
    });
  }
  return client;
}

/**
 * Recreating a populated collection silently discards every indexed repository,
 * so a size mismatch is reported as a fatal misconfiguration instead.
 */
export async function ensureCollection(): Promise<void> {
  if (collectionReady) return;

  const qdrant = getClient();
  const { exists } = await qdrant.collectionExists(COLLECTION_NAME);

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    await createPayloadIndexes(qdrant);
    console.log(
      `✓ Created Qdrant collection "${COLLECTION_NAME}" (${VECTOR_SIZE} dims)`
    );
    collectionReady = true;
    return;
  }

  const info = await qdrant.getCollection(COLLECTION_NAME);
  const vectorConfig = info.config?.params?.vectors as
    | { size?: number }
    | undefined;
  const existingSize = vectorConfig?.size;

  if (typeof existingSize === "number" && existingSize !== VECTOR_SIZE) {
    throw new Error(
      `Qdrant collection "${COLLECTION_NAME}" stores ${existingSize}-dimensional vectors ` +
        `but EMBEDDING_DIMENSIONS is ${VECTOR_SIZE}. Either set EMBEDDING_DIMENSIONS=${existingSize} ` +
        `to keep the existing index, or delete the collection and re-index every repository.`
    );
  }

  await createPayloadIndexes(qdrant);
  collectionReady = true;
}

async function createPayloadIndexes(qdrant: QdrantClient): Promise<void> {
  try {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: "repositoryId",
      field_schema: "keyword",
      wait: true,
    });
  } catch (error: any) {
    if (!error.message?.includes("already exists")) {
      console.warn("Failed to create payload index:", error.message);
    }
  }
}

export async function upsertChunks(
  chunks: CodeChunk[],
  embeddings: (number[] | null)[]
): Promise<number> {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Chunk/embedding length mismatch: ${chunks.length} chunks vs ${embeddings.length} embeddings`
    );
  }

  const qdrant = getClient();
  await ensureCollection();

  const points = chunks
    .map((chunk, index) => ({ chunk, vector: embeddings[index] }))
    .filter(
      (item): item is { chunk: CodeChunk; vector: number[] } =>
        Array.isArray(item.vector) && item.vector.length > 0
    )
    .map(({ chunk, vector }) => {
      if (vector.length !== VECTOR_SIZE) {
        throw new Error(
          `Embedding for ${chunk.metadata.filePath} has ${vector.length} dimensions, expected ${VECTOR_SIZE}`
        );
      }
      return {
        id: uuidv4(),
        vector,
        payload: {
          repositoryId: chunk.metadata.repositoryId,
          filePath: chunk.metadata.filePath,
          language: chunk.metadata.language,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
          chunkIndex: chunk.metadata.chunkIndex,
          content: chunk.content,
        },
      };
    });

  if (points.length === 0) {
    return 0;
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: points.slice(i, i + BATCH_SIZE),
    });
  }

  return points.length;
}

export interface SearchResult {
  content: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  score: number;
}

export async function searchSimilar(
  queryVector: number[],
  repositoryId: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const qdrant = getClient();

  const results = await qdrant.query(COLLECTION_NAME, {
    query: queryVector,
    filter: {
      must: [{ key: "repositoryId", match: { value: repositoryId } }],
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

export async function deleteByRepository(repositoryId: string): Promise<void> {
  const qdrant = getClient();
  await ensureCollection();

  await qdrant.delete(COLLECTION_NAME, {
    wait: true,
    filter: {
      must: [{ key: "repositoryId", match: { value: repositoryId } }],
    },
  });
}

export async function checkQdrantHealth(): Promise<void> {
  const qdrant = getClient();
  await qdrant.getCollections();
}
