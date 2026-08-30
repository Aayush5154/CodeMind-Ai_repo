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

export async function retrieveContext(
  question: string,
  repositoryId: string,
  topK: number = 5
): Promise<RetrievalResult> {
  let queryVector: number[];
  try {
    queryVector = await embedQuery(question);
  } catch (err: any) {
    console.error("Failed to embed query:", err.message, err.data || "");
    throw new Error(`Failed to generate query embedding: ${err.message}`);
  }

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
