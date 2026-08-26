import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import { Repository } from "./src/models/Repository.js";

async function run() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected to MongoDB:", env.MONGODB_URI);
    
    const repos = await Repository.find();
    console.log("All Repositories:");
    repos.forEach(r => console.log(`- ${r.owner}/${r.name} : ${r.status}`));
    
    const result = await Repository.updateMany(
      { status: "processing" },
      { $set: { status: "failed", error: "Backend crashed during indexing" } }
    );
    console.log(`Updated ${result.modifiedCount} repositories stuck in processing state.`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
