import mongoose, { Schema, Document } from "mongoose";

export interface IRepository extends Document {
  repoUrl: string;
  owner: string;
  name: string;
  branch: string;
  status: "pending" | "processing" | "completed" | "failed";
  filesProcessed: number;
  chunksCreated: number;
  error?: string;
  fileTree?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const repositorySchema = new Schema<IRepository>(
  {
    repoUrl: { type: String, required: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    branch: { type: String, default: "main" },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    filesProcessed: { type: Number, default: 0 },
    chunksCreated: { type: Number, default: 0 },
    error: { type: String },
    fileTree: [{ type: String }],
  },
  { timestamps: true }
);

// Prevent duplicate indexing of the same repo
repositorySchema.index({ owner: 1, name: 1 }, { unique: true });

export const Repository = mongoose.model<IRepository>(
  "Repository",
  repositorySchema
);
