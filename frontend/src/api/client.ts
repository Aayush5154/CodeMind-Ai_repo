/**
 * In development Vite proxies /api to the local backend, so a relative base works.
 * In production VITE_API_URL must point at the deployed API; it is inlined at
 * build time, so it has to be set before `vite build` runs.
 */
function resolveApiBase(): { base: string; misconfigured: boolean } {
  const configured = import.meta.env.VITE_API_URL?.trim();

  if (configured) {
    return { base: configured.replace(/\/+$/, ""), misconfigured: false };
  }

  // Reported per request rather than thrown at import time, which would leave
  // the user staring at a blank page with no explanation.
  if (import.meta.env.PROD) {
    console.error(
      "VITE_API_URL is not set. Set it to the backend URL (e.g. https://codemind-api.onrender.com/api) and rebuild the frontend."
    );
    return { base: "/api", misconfigured: true };
  }

  return { base: "/api", misconfigured: false };
}

const { base: API_BASE, misconfigured: API_MISCONFIGURED } = resolveApiBase();

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

const REQUEST_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (API_MISCONFIGURED) {
    throw new ApiError(
      "This deployment is misconfigured: VITE_API_URL was not set when the frontend was built.",
      0
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // A cold-started Render instance plus a slow model call can exceed a minute,
  // but a hung request should still resolve rather than spin forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("The request timed out. Please try again.", 408);
    }
    throw new ApiError(
      "Cannot reach the server. Check your connection and try again.",
      0
    );
  } finally {
    clearTimeout(timeout);
  }

  // Proxy errors and rate-limit pages are not always JSON.
  const raw = await res.text();
  let data: any = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      removeToken();
    }
    throw new ApiError(
      data?.message || `Request failed with status ${res.status}`,
      res.status
    );
  }

  return data as T;
}

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

export interface Repository {
  _id: string;
  repoUrl: string;
  owner: string;
  name: string;
  branch: string;
  status: "pending" | "processing" | "completed" | "failed";
  filesProcessed: number;
  chunksCreated: number;
  chunksIndexed?: number;
  error?: string;
  fileTree?: string[];
  createdAt: string;
  updatedAt: string;
}

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
