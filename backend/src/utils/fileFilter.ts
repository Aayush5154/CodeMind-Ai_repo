import path from "path";

export const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".cpp",
  ".c",
  ".h",
  ".hpp",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".scala",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".json",
  ".yaml",
  ".yml",
  ".md",
  ".mdx",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".dockerfile",
  ".toml",
  ".xml",
  ".graphql",
  ".gql",
  ".prisma",
  ".env.example",
]);

const IGNORED_PATTERNS: RegExp[] = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /\.nuxt\//,
  /out\//,
  /coverage\//,
  /\.nyc_output\//,
  /\.cache\//,
  /\.turbo\//,
  /\.vercel\//,
  /vendor\//,
  /__pycache__\//,
  /\.pytest_cache\//,
  /venv\//,
  /\.venv\//,
  /target\//,
  /bin\//,
  /obj\//,
];

const IGNORED_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "composer.lock",
  "Gemfile.lock",
  "Cargo.lock",
  "poetry.lock",
  ".DS_Store",
  "Thumbs.db",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".prettierrc",
  ".eslintignore",
]);

const MAX_FILE_SIZE = 100 * 1024;

export function shouldProcessFile(filePath: string, size?: number): boolean {
  if (size !== undefined && size > MAX_FILE_SIZE) {
    return false;
  }

  for (const pattern of IGNORED_PATTERNS) {
    if (pattern.test(filePath)) {
      return false;
    }
  }

  const basename = path.basename(filePath);
  if (IGNORED_FILES.has(basename)) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();

  if (basename === "Dockerfile" || basename.startsWith("Dockerfile.")) {
    return true;
  }

  return SUPPORTED_EXTENSIONS.has(ext);
}

export function getLanguageFromExtension(
  filePath: string
): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".js": "js",
    ".jsx": "js",
    ".ts": "js",
    ".tsx": "js",
    ".py": "python",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "cpp",
    ".h": "cpp",
    ".hpp": "cpp",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".scala": "scala",
    ".html": "html",
    ".md": "markdown",
    ".mdx": "markdown",
    ".latex": "latex",
    ".tex": "latex",
  };
  return map[ext];
}

export function getLanguageName(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".sql": "sql",
    ".sh": "shell",
    ".graphql": "graphql",
    ".prisma": "prisma",
    ".xml": "xml",
  };
  return map[ext] || "text";
}
