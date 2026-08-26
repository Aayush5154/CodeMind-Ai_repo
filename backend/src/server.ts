import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";

async function start(): Promise<void> {
  // Connect to MongoDB
  await connectDatabase();

  // Start Express server
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
