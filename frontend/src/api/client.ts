const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

// ── Repository Types ──────────────────────────────────────────────────────

export interface Repository {
  _id: string;
  repoUrl: string;
  owner: string;
  name: string;
  branch: string;
  status: "pending" | "processing" | "completed" | "failed";
  filesProcessed: number;
  chunksCreated: number;
  error?: string;
  fileTree?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Chat Types ────────────────────────────────────────────────────────────

export interface Source {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

export interface Message {
  _id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  createdAt: string;
}

export interface AskResponse {
  success: boolean;
  data: {
    answer: string;
    sources: Source[];
    sessionId: string;
    messageId: string;
  };
}

// ── Repository API ────────────────────────────────────────────────────────

export async function indexRepository(
  repoUrl: string
): Promise<{ success: boolean; repositoryId: string; status: string }> {
  return request("/repositories/index", {
    method: "POST",
    body: JSON.stringify({ repoUrl }),
  });
}

export async function getRepositoryStatus(
  id: string
): Promise<{ success: boolean; data: Repository }> {
  return request(`/repositories/${id}/status`);
}

export async function listRepositories(): Promise<{
  success: boolean;
  data: Repository[];
}> {
  return request("/repositories");
}

// ── Chat API ──────────────────────────────────────────────────────────────

export async function createChatSession(
  repositoryId: string
): Promise<{ success: boolean; data: { sessionId: string; repositoryId: string } }> {
  return request("/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ repositoryId }),
  });
}

export async function askQuestion(
  repositoryId: string,
  question: string,
  sessionId?: string
): Promise<AskResponse> {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ repositoryId, question, sessionId }),
  });
}

export async function getChatHistory(
  sessionId: string
): Promise<{ success: boolean; data: Message[] }> {
  return request(`/chat/sessions/${sessionId}/messages`);
}
