import mongoose, { Schema, Document } from "mongoose";

export interface ISource {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

export interface IMessage extends Document {
  sessionId: mongoose.Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  sources: ISource[];
  createdAt: Date;
}

const sourceSchema = new Schema<ISource>(
  {
    filePath: { type: String, required: true },
    startLine: { type: Number },
    endLine: { type: Number },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "ChatSession",
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: { type: String, required: true },
    sources: [sourceSchema],
  },
  { timestamps: true }
);

messageSchema.index({ sessionId: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
