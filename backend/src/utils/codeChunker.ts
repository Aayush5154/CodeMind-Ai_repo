import {
  RecursiveCharacterTextSplitter,
  SupportedTextSplitterLanguage,
} from "@langchain/textsplitters";
import { getLanguageFromExtension, getLanguageName } from "./fileFilter.js";

export interface CodeChunk {
  content: string;
  metadata: {
    repositoryId: string;
    filePath: string;
    language: string;
    startLine: number;
    endLine: number;
    chunkIndex: number;
  };
}

interface ChunkerOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

const DEFAULT_CHUNK_SIZE = 1500;
const DEFAULT_CHUNK_OVERLAP = 200;

function computeLineRange(
  fullContent: string,
  chunkContent: string,
  searchStartOffset: number
): { startLine: number; endLine: number; nextOffset: number } {
  const chunkStartIndex = fullContent.indexOf(chunkContent, searchStartOffset);

  if (chunkStartIndex === -1) {
    const linesBefore = fullContent
      .substring(0, searchStartOffset)
      .split("\n").length;
    const chunkLines = chunkContent.split("\n").length;
    return {
      startLine: linesBefore,
      endLine: linesBefore + chunkLines - 1,
      nextOffset: searchStartOffset + chunkContent.length,
    };
  }

  const startLine =
    fullContent.substring(0, chunkStartIndex).split("\n").length;
  const chunkLines = chunkContent.split("\n").length;
  const endLine = startLine + chunkLines - 1;

  return {
    startLine,
    endLine,
    nextOffset: chunkStartIndex + chunkContent.length,
  };
}

export async function chunkFile(
  filePath: string,
  content: string,
  repositoryId: string,
  options: ChunkerOptions = {}
): Promise<CodeChunk[]> {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    chunkOverlap = DEFAULT_CHUNK_OVERLAP,
  } = options;

  if (!content.trim()) {
    return [];
  }

  const language = getLanguageFromExtension(filePath);
  const languageName = getLanguageName(filePath);

  let splitter: RecursiveCharacterTextSplitter;

  try {
    if (language) {
      splitter = RecursiveCharacterTextSplitter.fromLanguage(
        language as SupportedTextSplitterLanguage,
        { chunkSize, chunkOverlap }
      );
    } else {
      splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
      });
    }
  } catch {
    splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
  }

  const docs = await splitter.createDocuments([content]);

  let searchOffset = 0;
  const chunks: CodeChunk[] = docs.map((doc, index) => {
    const { startLine, endLine, nextOffset } = computeLineRange(
      content,
      doc.pageContent,
      searchOffset
    );
    searchOffset = nextOffset;

    return {
      content: doc.pageContent,
      metadata: {
        repositoryId,
        filePath,
        language: languageName,
        startLine,
        endLine,
        chunkIndex: index,
      },
    };
  });

  return chunks;
}

export async function chunkFiles(
  files: { path: string; content: string }[],
  repositoryId: string,
  options: ChunkerOptions = {}
): Promise<CodeChunk[]> {
  const allChunks: CodeChunk[] = [];

  for (const file of files) {
    const chunks = await chunkFile(
      file.path,
      file.content,
      repositoryId,
      options
    );
    allChunks.push(...chunks);
  }

  return allChunks;
}
