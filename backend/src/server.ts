import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import mongoose from "mongoose";

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

    if (oldIndex && oldIndex.name) {
      console.log(`  Dropping old index: ${oldIndex.name}`);
      await collection.dropIndex(oldIndex.name);
    }
  } catch (err) {
    console.log("  Index migration skipped (collection may not exist yet)");
  }
}

async function start(): Promise<void> {
  await connectDatabase();
  await migrateIndexes();
  await mongoose.model("Repository").syncIndexes();

  app.listen(env.PORT, () => {
    console.log(`✓ CodeMind server running on port ${env.PORT}`);
    console.log(`  LLM Provider: ${env.LLM_PROVIDER}`);
    console.log(`  LLM Model: ${env.LLM_MODEL}`);
    console.log(`  Embedding Model: ${env.EMBEDDING_MODEL}`);
    console.log(`  Qdrant: ${env.QDRANT_URL}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
