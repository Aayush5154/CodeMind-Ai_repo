import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

let llmInstance: ChatGoogleGenerativeAI | null = null;

function getLLM(): ChatGoogleGenerativeAI {
  if (!llmInstance) {
    llmInstance = new ChatGoogleGenerativeAI({
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
      temperature: 0.1,
      maxOutputTokens: 2048,
      maxRetries: 3,
    });
  }
  return llmInstance;
}

const RAG_SYSTEM_PROMPT = `You are CodeMind, an AI assistant helping a developer understand a software repository.

Answer the user's question using the provided code context. Follow these rules:

1. Base your answer primarily on the provided code context.
2. Do NOT invent files, functions, APIs, or behavior that are not present in the context.
3. If the retrieved context is insufficient to answer confidently, clearly say so. For example: "I couldn't find enough relevant code in the indexed repository to answer this confidently."
4. Explain your reasoning in a clear, developer-friendly way.
5. Reference relevant file names in your answer.
6. Mention line numbers when they are available in the context.
7. When describing a flow or process, explain it step-by-step.
8. Use markdown formatting (code blocks, bold, lists) for readability.
9. Keep answers focused and concise — avoid unnecessary verbosity.

Repository Context:
{context}`;

const chatPrompt = ChatPromptTemplate.fromMessages([
  ["system", RAG_SYSTEM_PROMPT],
  ["placeholder", "{history}"],
  ["human", "{question}"],
]);

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateAnswer(
  question: string,
  context: string,
  chatHistory: ChatHistoryMessage[] = []
): Promise<string> {
  const llm = getLLM();

  const history = chatHistory.map(
    (msg) =>
      [msg.role === "user" ? "human" : "assistant", msg.content] as [
        string,
        string
      ]
  );

  try {
    const response = await chatPrompt.pipe(llm).invoke({
      context,
      question,
      history,
    });

    const answer =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    if (!answer.trim()) {
      throw new AppError(
        "The model returned an empty response. Please rephrase your question.",
        502
      );
    }

    return answer;
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    const message = error?.message ?? "";
    console.error("LLM generation failed:", message.slice(0, 300));

    if (/quota|429|RESOURCE_EXHAUSTED/i.test(message)) {
      throw new AppError(
        "The AI provider's rate limit is exhausted. Please wait a minute and try again.",
        429
      );
    }
    if (/SAFETY|blocked/i.test(message)) {
      throw new AppError(
        "The model declined to answer this question. Please rephrase it.",
        422
      );
    }
    throw new AppError("Failed to generate an answer. Please try again.", 502);
  }
}
