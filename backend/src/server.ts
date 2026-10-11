import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { ensureCollection, checkQdrantHealth } from "./services/vector.service.js";
import { probeEmbeddingDimensions } from "./services/embedding.service.js";
import { recoverStuckIngestions } from "./services/ingestion.service.js";
import mongoose from "mongoose";
import type { Server } from "http";

async function migrateIndexes(): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const collection = db.collection("repositories");
    const indexes = await collection.indexes();

    const oldIndex = indexes.find(
      (idx) =>
        idx.key &&
        idx.key.owner === 1 &&
        idx.key.name === 1 &&
        !idx.key.userId &&
        idx.unique === true
    );

    if (oldIndex?.name) {
      console.log(`  Dropping old index: ${oldIndex.name}`);
      await collection.dropIndex(oldIndex.name);
    }
  } catch {
    console.log("  Index migration skipped (collection may not exist yet)");
  }
}

/**
 * A wrong EMBEDDING_DIMENSIONS only shows up as a Qdrant rejection midway through
 * the first ingestion, so the real vector width is checked before serving traffic.
 */
async function verifyEmbeddingDimensions(): Promise<void> {
  const actual = await probeEmbeddingDimensions();
  if (actual !== env.EMBEDDING_DIMENSIONS) {
    throw new Error(
      `EMBEDDING_DIMENSIONS is ${env.EMBEDDING_DIMENSIONS} but ${env.EMBEDDING_MODEL} returns ${actual}-dimensional vectors. ` +
        `Set EMBEDDING_DIMENSIONS=${actual}.`
    );
  }
  console.log(`✓ Embedding model verified (${actual} dimensions)`);
}

let server: Server | undefined;
let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} received — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      console.log("  HTTP server closed");
    }
    await mongoose.connection.close(false);
    console.log("  MongoDB connection closed");
  } catch (err) {
    console.error("  Error during shutdown:", err);
    exitCode = 1;
  }

  clearTimeout(forceExit);
  process.exit(exitCode);
}

async function start(): Promise<void> {
  await connectDatabase();
  await migrateIndexes();
  await mongoose.model("Repository").syncIndexes();
  await recoverStuckIngestions();

  await checkQdrantHealth();
  console.log("✓ Qdrant reachable");

  await verifyEmbeddingDimensions();
  await ensureCollection();

  // Render's health check requires the port to be bound, so listen on 0.0.0.0.
  server = app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`✓ CodeMind server running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`  LLM Model: ${env.LLM_MODEL}`);
    console.log(`  Embedding Model: ${env.EMBEDDING_MODEL}`);
    console.log(
      `  Embedding budget: ${env.EMBEDDING_REQUESTS_PER_MINUTE}/min, batch ${env.EMBEDDING_BATCH_SIZE}`
    );
    console.log(
      `  CORS: ${env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS.join(", ") : "all origins (development)"}`
    );

    // ─── Self-ping keep-alive (production only) ──────────────────────────
    // Render free tier spins down after 15 min of inactivity. Pinging the
    // local health endpoint every 14 min keeps the service warm without any
    // external dependency or GitHub Actions secret.
    if (env.isProduction) {
      const healthUrl = `http://localhost:${env.PORT}/api/health`;
      const KEEP_ALIVE_MS = 14 * 60 * 1_000; // 14 minutes

      const keepAliveTimer = setInterval(async () => {
        try {
          const res = await fetch(healthUrl, { signal: AbortSignal.timeout(10_000) });
          console.log(`Keep-alive ping → ${res.status}`);
        } catch (err) {
          console.warn("Keep-alive ping failed:", err instanceof Error ? err.message : err);
        }
      }, KEEP_ALIVE_MS);

      // Don't let the timer prevent graceful shutdown
      keepAliveTimer.unref();

      console.log(`  Keep-alive self-ping enabled (every 14 min → ${healthUrl})`);
    }
  });

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  void shutdown("uncaughtException", 1);
});

start().catch((err) => {
  console.error("✗ Failed to start server:", err instanceof Error ? err.message : err);
  process.exit(1);
});
