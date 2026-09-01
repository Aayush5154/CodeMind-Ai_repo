import mongoose, { Schema, Document } from "mongoose";

export type RepositoryStatus = "pending" | "processing" | "completed" | "failed";

export interface IRepository extends Document {
  userId: mongoose.Types.ObjectId;
  repoUrl: string;
  owner: string;
  name: string;
  branch: string;
  status: RepositoryStatus;
  filesProcessed: number;
  chunksCreated: number;
  chunksIndexed: number;
  error?: string;
  fileTree?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const repositorySchema = new Schema<IRepository>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
    chunksIndexed: { type: Number, default: 0 },
    error: { type: String },
    fileTree: [{ type: String }],
  },
  { timestamps: true }
);

repositorySchema.index({ userId: 1, owner: 1, name: 1 }, { unique: true });

export const Repository = mongoose.model<IRepository>(
  "Repository",
  repositorySchema
);
