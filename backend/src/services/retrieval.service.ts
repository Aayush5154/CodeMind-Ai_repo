import { embedQuery } from "./embedding.service.js";
import { searchSimilar, SearchResult } from "./vector.service.js";

export interface RetrievalResult {
  context: string;
  sources: {
    filePath: string;
    startLine: number;
    endLine: number;
  }[];
}

/**
 * Retrieves relevant code context for a user question from the vector store.
 *
 * Pipeline:
 * 1. Embed the question
 * 2. Search Qdrant for similar chunks (filtered by repositoryId)
 * 3. Format results into a context string + source metadata
 */
export async function retrieveContext(
  question: string,
  repositoryId: string,
  topK: number = 5
): Promise<RetrievalResult> {
  // Step 1: Embed the question
  let queryVector: number[];
  try {
    queryVector = await embedQuery(question);
  } catch (err: any) {
    console.error("Failed to embed query:", err.message, err.data || "");
    throw new Error(`Failed to generate query embedding: ${err.message}`);
  }

  // Step 2: Search for similar code chunks
  let results: SearchResult[];
  try {
    results = await searchSimilar(queryVector, repositoryId, topK);
  } catch (err: any) {
    console.error("Qdrant search failed:", err.message, err.data || "");
    throw new Error(`Vector search failed: ${err.data?.status?.error || err.message}`);
  }

  if (results.length === 0) {
    return {
      context: "No relevant code was found in the indexed repository.",
      sources: [],
    };
  }

  // Step 3: Format context
  const contextParts = results.map((result, index) => {
    const lineInfo =
      result.startLine && result.endLine
        ? ` (Lines ${result.startLine}–${result.endLine})`
        : "";
    return [
      `--- Source ${index + 1}: ${result.filePath}${lineInfo} ---`,
      `Language: ${result.language}`,
      ``,
      result.content,
      ``,
    ].join("\n");
  });

  const context = contextParts.join("\n");

  // Deduplicate sources by file path
  const sourceMap = new Map<
    string,
    { filePath: string; startLine: number; endLine: number }
  >();
  for (const result of results) {
    const key = `${result.filePath}:${result.startLine}-${result.endLine}`;
    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        filePath: result.filePath,
        startLine: result.startLine,
        endLine: result.endLine,
      });
    }
  }

  return {
    context,
    sources: Array.from(sourceMap.values()),
  };
}
