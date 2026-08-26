const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// ── Token Management ──────────────────────────────────────────────────────

const TOKEN_KEY = "codemind_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── HTTP Client ───────────────────────────────────────────────────────────

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Inject auth token if available
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

// ── Auth Types ────────────────────────────────────────────────────────────

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: AuthUser;
    token: string;
  };
}

// ── Auth API ──────────────────────────────────────────────────────────────

export async function authRegister(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function authLogin(
  email: string,
  password: string
): Promise<AuthResponse> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function authGetMe(): Promise<{
  success: boolean;
  data: AuthUser;
}> {
  return request("/auth/me");
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
