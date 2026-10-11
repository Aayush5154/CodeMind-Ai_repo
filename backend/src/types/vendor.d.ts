// Ambient module declarations for packages whose types cannot be resolved
// under "moduleResolution": "NodeNext".  These stubs are intentionally loose
// (`any`) to avoid blocking the build while still allowing named imports.

declare module "@google/generative-ai" {
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(config: Record<string, unknown>): GenerativeModel;
  }
  export class GenerativeModel {
    batchEmbedContents(request: any): Promise<any>;
    embedContent(request: any): Promise<any>;
    generateContent(request: any): Promise<any>;
  }
  export type TaskType = string;
  export const TaskType: Record<string, string>;
}

declare module "@langchain/google-genai" {
  export class ChatGoogleGenerativeAI {
    constructor(config: Record<string, unknown>);
    invoke(input: any): Promise<any>;
    [key: string]: any;
  }
}

declare module "@qdrant/js-client-rest" {
  export class QdrantClient {
    constructor(config: Record<string, unknown>);
    getCollections(): Promise<any>;
    createCollection(name: string, config: any): Promise<any>;
    upsert(collection: string, data: any): Promise<any>;
    search(collection: string, query: any): Promise<any>;
    delete(collection: string, query: any): Promise<any>;
    [key: string]: any;
  }
}
