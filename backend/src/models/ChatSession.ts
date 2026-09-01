import mongoose, { Schema, Document } from "mongoose";

export interface IChatSession extends Document {
  repositoryId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    repositoryId: {
      type: Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

chatSessionSchema.index({ userId: 1, repositoryId: 1, updatedAt: -1 });

export const ChatSession = mongoose.model<IChatSession>(
  "ChatSession",
  chatSessionSchema
);
