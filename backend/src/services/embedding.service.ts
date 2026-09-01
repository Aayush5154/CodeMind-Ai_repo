import {
  GoogleGenerativeAI,
  type GenerativeModel,
  TaskType,
} from "@google/generative-ai";
import { env } from "../config/env.js";

let modelInstance: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!modelInstance) {
    modelInstance = new GoogleGenerativeAI(env.LLM_API_KEY).getGenerativeModel({
      model: env.EMBEDDING_MODEL,
    });
  }
  return modelInstance;
}

/**
 * Gemini counts every embedded text against the per-minute quota, including the
 * ones bundled into a single batchEmbedContents call, so the limiter is spent in
 * units of texts rather than HTTP requests.
 */
class SlidingWindowRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = 60_000
  ) {}

  async acquire(permits: number): Promise<void> {
    if (permits > this.limit) {
      throw new Error(
        `Cannot acquire ${permits} permits from a limiter with a ceiling of ${this.limit}`
      );
    }

    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

      if (this.timestamps.length + permits <= this.limit) {
        for (let i = 0; i < permits; i++) {
          this.timestamps.push(now);
        }
        return;
      }

      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 250;
      console.log(
        `  Embedding rate limit reached — waiting ${Math.ceil(waitMs / 1000)}s`
      );
      await sleep(waitMs);
    }
  }

  /** Drops the window so the next acquire waits out a full quota period. */
  penalize(): void {
    const now = Date.now();
    this.timestamps = new Array(this.limit).fill(now);
  }
}

const limiter = new SlidingWindowRateLimiter(env.EMBEDDING_REQUESTS_PER_MINUTE);

const MAX_ATTEMPTS = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const message = (error as Error)?.message ?? "";
  return (
    message.includes("429") ||
    message.includes("Too Many Requests") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota")
  );
}

function isRetryableError(error: unknown): boolean {
  const message = (error as Error)?.message ?? "";
  return (
    isRateLimitError(error) ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("fetch failed")
  );
}

/**
 * Gemini reports how long to wait in a RetryInfo entry embedded in the error
 * message ("Please retry in 53.7s" / "retryDelay":"53s"). Honouring it is much
 * cheaper than guessing with pure exponential backoff.
 */
function parseRetryDelayMs(error: unknown): number | null {
  const message = (error as Error)?.message ?? "";

  const retryInfo = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (retryInfo) {
    return Math.ceil(Number(retryInfo[1]) * 1000);
  }

  const prose = message.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (prose) {
    return Math.ceil(Number(prose[1]) * 1000);
  }

  return null;
}

function backoffMs(attempt: number): number {
  const base = Math.min(2 ** attempt * 1000, 32_000);
  return base + Math.floor(Math.random() * 1000);
}

async function embedBatchWithRetry(
  texts: string[],
  taskType: TaskType
): Promise<number[][]> {
  const model = getModel();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await limiter.acquire(texts.length);

    try {
      const response = await model.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { role: "user", parts: [{ text }] },
          taskType,
        })),
      });

      const vectors = response.embeddings.map((e) => e.values ?? []);

      const emptyCount = vectors.filter((v) => v.length === 0).length;
      if (emptyCount > 0) {
        throw new Error(
          `Embedding API returned ${emptyCount} empty vector(s) out of ${texts.length}. ` +
            `Verify that EMBEDDING_MODEL="${env.EMBEDDING_MODEL}" is correct and available to this API key.`
        );
      }

      return vectors;
    } catch (error) {
      lastError = error;

      if (isRateLimitError(error)) {
        limiter.penalize();
      }

      if (!isRetryableError(error) || attempt === MAX_ATTEMPTS - 1) {
        break;
      }

      const waitMs = parseRetryDelayMs(error) ?? backoffMs(attempt);
      console.warn(
        `  Embedding batch failed (attempt ${attempt + 1}/${MAX_ATTEMPTS}), retrying in ${Math.ceil(
          waitMs / 1000
        )}s: ${(error as Error).message.split("\n")[0].slice(0, 200)}`
      );
      await sleep(waitMs);
    }
  }

  throw new Error(
    `Failed to embed a batch of ${texts.length} texts after ${MAX_ATTEMPTS} attempts: ${
      (lastError as Error)?.message ?? "unknown error"
    }`
  );
}

/**
 * Embeds documents and returns a result aligned 1:1 with `texts`. Blank inputs
 * yield `null` so callers can keep their own metadata in step; any other
 * failure throws rather than silently producing a hole in the index.
 */
export async function embedDocuments(
  texts: string[]
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = new Array(texts.length).fill(null);

  const pending = texts
    .map((text, index) => ({ index, text: text.trim() }))
    .filter((item) => item.text.length > 0);

  if (pending.length === 0) {
    return results;
  }

  const batchSize = Math.max(
    1,
    Math.min(env.EMBEDDING_BATCH_SIZE, env.EMBEDDING_REQUESTS_PER_MINUTE)
  );

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const vectors = await embedBatchWithRetry(
      batch.map((item) => item.text),
      TaskType.RETRIEVAL_DOCUMENT
    );

    batch.forEach((item, j) => {
      results[item.index] = vectors[j];
    });

    const done = Math.min(i + batchSize, pending.length);
    console.log(`  Embedded ${done}/${pending.length} chunks`);
  }

  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot embed an empty query");
  }

  const [vector] = await embedBatchWithRetry([trimmed], TaskType.RETRIEVAL_QUERY);
  return vector;
}

/** Verified at boot so a dimension mismatch surfaces before any ingestion. */
export async function probeEmbeddingDimensions(): Promise<number> {
  const [vector] = await embedBatchWithRetry(
    ["dimension probe"],
    TaskType.RETRIEVAL_QUERY
  );
  return vector.length;
}
