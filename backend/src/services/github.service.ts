import axios from "axios";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

interface RepoInfo {
  owner: string;
  repo: string;
}

interface TreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

interface TreeResponse {
  sha: string;
  url: string;
  tree: TreeItem[];
  truncated: boolean;
}

interface FileContent {
  path: string;
  content: string;
}

const GITHUB_API = "https://api.github.com";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "CodeMind-AI",
  };
  if (env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${env.GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * Validates and extracts owner/repo from a GitHub URL.
 */
export function parseGitHubUrl(url: string): RepoInfo {
  // Support formats:
  //   https://github.com/owner/repo
  //   https://github.com/owner/repo.git
  //   https://github.com/owner/repo/tree/branch
  //   github.com/owner/repo
  const patterns = [
    /^(?:https?:\/\/)?github\.com\/([^\/\s]+)\/([^\/\s#?.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ""),
      };
    }
  }

  throw new AppError("Invalid GitHub repository URL", 400);
}

/**
 * Gets the default branch of a repository.
 */
export async function getDefaultBranch(
  owner: string,
  repo: string
): Promise<string> {
  try {
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: getHeaders(),
    });
    return response.data.default_branch || "main";
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new AppError("Repository not found", 404);
    }
    if (error.response?.status === 403) {
      throw new AppError(
        "GitHub API rate limit exceeded. Please add a GITHUB_TOKEN.",
        429
      );
    }
    throw new AppError("Failed to fetch repository information", 500);
  }
}

/**
 * Fetches the full file tree of a repository recursively.
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string
): Promise<TreeItem[]> {
  try {
    const response = await axios.get<TreeResponse>(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: getHeaders() }
    );

    if (response.data.truncated) {
      console.warn(
        `Repository tree is truncated (>${response.data.tree.length} entries). Some files may be missed.`
      );
    }

    // Return only blobs (files), not trees (directories)
    return response.data.tree.filter((item) => item.type === "blob");
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new AppError("Repository or branch not found", 404);
    }
    if (error.response?.status === 409) {
      throw new AppError("Repository is empty", 422);
    }
    throw new AppError("Failed to fetch repository tree", 500);
  }
}

/**
 * Fetches the content of a single file from the repository.
 * Uses the GitHub Contents API which returns base64-encoded content.
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<FileContent> {
  try {
    const response = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: getHeaders(),
        params: { ref: branch },
      }
    );

    if (response.data.encoding === "base64" && response.data.content) {
      const content = Buffer.from(
        response.data.content,
        "base64"
      ).toString("utf-8");
      return { path, content };
    }

    throw new AppError(`Unable to decode file: ${path}`, 422);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.response?.status === 404) {
      throw new AppError(`File not found: ${path}`, 404);
    }
    // GitHub 403 can mean rate-limit OR file-too-large (>1MB)
    if (error.response?.status === 403) {
      const rateLimitRemaining = error.response?.headers?.["x-ratelimit-remaining"];
      if (rateLimitRemaining === "0" || rateLimitRemaining === 0) {
        throw new AppError(
          "GitHub API rate limit exceeded. Please add a GITHUB_TOKEN to your .env file.",
          429
        );
      }
      // File too large for Contents API (>1MB) — skip gracefully
      console.warn(`Skipping large file: ${path}`);
      return { path, content: "" };
    }
    throw new AppError(`Failed to fetch file: ${path}`, 500);
  }
}

/**
 * Fetches multiple files in parallel with concurrency control.
 */
export async function fetchFilesInBatches(
  owner: string,
  repo: string,
  paths: string[],
  branch: string,
  batchSize: number = 10
): Promise<FileContent[]> {
  const results: FileContent[] = [];

  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((p) => fetchFileContent(owner, repo, p, branch))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value.content) {
        results.push(result.value);
      }
    }
  }

  return results;
}
