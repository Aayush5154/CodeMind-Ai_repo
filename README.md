# CodeMind — AI Codebase Assistant

CodeMind is a RAG-powered (Retrieval-Augmented Generation) developer tool that indexes GitHub repositories and allows you to ask natural-language questions about codebases. It fetches the code, chunks it, generates vector embeddings, stores them in Qdrant, and uses LangChain with modern LLMs to provide context-aware, highly accurate answers complete with source references.

## ✨ Features

- **GitHub Integration**: Connect any public GitHub repository and let CodeMind index it automatically.
- **Semantic Search**: Find relevant code, functions, and concepts using natural language queries.
- **Conversational AI**: Ask follow-up questions and get context-aware answers about your codebase.
- **Source References**: Every answer comes with accurate file paths and line numbers you can trust.
- **User Authentication**: Secure JWT-based authentication allows users to maintain their own isolated workspaces and indexed repositories.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Vanilla CSS (Glassmorphism UI) |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (app data), Qdrant (vector store) |
| AI | LangChain, Google Gemini / OpenAI |

## 🏗 Architecture

```
User → React UI → REST API → Express Server
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                GitHub Service  RAG Service    Chat Service
                    │               │               │
                GitHub API       Qdrant          MongoDB
                                    │
                                   LLM
```

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB account/cluster
- Qdrant Vector DB instance (Cloud or Local via Docker)
- Google Gemini API Key (or OpenAI API Key)
- GitHub Personal Access Token (optional, to avoid API rate limits)

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd <your-repo-directory>
```

### 2. Backend Setup
Navigate to the backend directory and install dependencies:
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
# Server
PORT=5000

# MongoDB
MONGODB_URI=your_mongodb_connection_string

# Qdrant Vector Database
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key

# LLM Configuration
LLM_PROVIDER=gemini # or openai
LLM_API_KEY=your_llm_api_key
LLM_MODEL=gemini-3.6-flash

# Embedding Configuration
EMBEDDING_MODEL=text-embedding-004

# JWT Authentication
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# GitHub
GITHUB_TOKEN=your_github_pat
```

Run the backend development server:
```bash
npm run dev
```

### 3. Frontend Setup
Open a new terminal, navigate to the frontend directory, and install dependencies:
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory (if you are running the backend on a different port than 5000):
```env
VITE_API_URL=http://localhost:5000/api
```

Run the frontend development server:
```bash
npm run dev
```

### 4. Open the App
Navigate to `http://localhost:5173` in your browser. Create an account, paste a GitHub URL, and start chatting with your codebase!

## 🤝 Contributing
Contributions are welcome! Feel free to open an issue or submit a pull request.

## 📄 License
This project is licensed under the MIT License.