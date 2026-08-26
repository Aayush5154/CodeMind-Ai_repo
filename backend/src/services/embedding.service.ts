import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { env } from "../config/env.js";

let embeddingsInstance: GoogleGenerativeAIEmbeddings | null = null;

/**
 * Returns a singleton OpenAI embeddings instance.
 */
function getEmbeddings(): GoogleGenerativeAIEmbeddings {
  if (!embeddingsInstance) {
    embeddingsInstance = new GoogleGenerativeAIEmbeddings({
      apiKey: env.LLM_API_KEY,
      modelName: env.EMBEDDING_MODEL,
    });
  }
  return embeddingsInstance;
}

/**
 * Generates embeddings for an array of text strings.
 * Processes in batches to respect API limits.
 */
export async function embedTexts(
  texts: string[],
  batchSize: number = 100
): Promise<number[][]> {
  const embeddings = getEmbeddings();
  const allEmbeddings: number[][] = [];

  // Filter out empty/whitespace-only texts that the API can't embed
  const validTexts = texts.map((t) => t.trim()).filter((t) => t.length > 0);

  if (validTexts.length === 0) {
    console.warn("  ⚠ No valid texts to embed (all empty or whitespace-only)");
    return [];
  }

  for (let i = 0; i < validTexts.length; i += batchSize) {
    const batch = validTexts.slice(i, i + batchSize);
    const batchEmbeddings = await embeddings.embedDocuments(batch);

    // Validate that embeddings are not empty
    for (let j = 0; j < batchEmbeddings.length; j++) {
      if (!batchEmbeddings[j] || batchEmbeddings[j].length === 0) {
        console.warn(
          `  ⚠ Empty embedding returned for text at index ${i + j} (length: ${batch[j].length} chars)`
        );
      }
    }

    allEmbeddings.push(...batchEmbeddings);
  }

  // Check if all embeddings are empty
  const nonEmpty = allEmbeddings.filter((e) => e && e.length > 0);
  if (nonEmpty.length === 0) {
    throw new Error(
      `Embedding API returned empty vectors for all ${validTexts.length} texts. ` +
        `Check that EMBEDDING_MODEL="${env.EMBEDDING_MODEL}" is valid and your LLM_API_KEY has access to it.`
    );
  }

  if (nonEmpty.length < allEmbeddings.length) {
    console.warn(
      `  ⚠ ${allEmbeddings.length - nonEmpty.length} of ${allEmbeddings.length} embeddings were empty`
    );
  }

  return allEmbeddings;
}

/**
 * Generates an embedding for a single query string.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const embeddings = getEmbeddings();
  return embeddings.embedQuery(text);
}
