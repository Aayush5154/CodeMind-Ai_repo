import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  Sparkles,
  GitBranch,
  MessageSquare,
  Code2,
  Search,
  ArrowRight,
  FolderGit2,
  Loader2,
} from "lucide-react";
import {
  indexRepository,
  getRepositoryStatus,
  type Repository,
} from "../api/client";
import "./LandingPage.css";

interface LandingPageProps {
  onRepoSelect: (repo: Repository) => void;
}

export default function LandingPage({ onRepoSelect }: LandingPageProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!repoUrl.trim()) return;

      setLoading(true);
      setError(null);

      try {
        const res = await indexRepository(repoUrl.trim());
        const statusRes = await getRepositoryStatus(res.repositoryId);
        onRepoSelect(statusRes.data);
        navigate("/chat");
      } catch (err: any) {
        setError(err.message || "Failed to index repository");
      } finally {
        setLoading(false);
      }
    },
    [repoUrl, navigate, onRepoSelect]
  );

  return (
    <div className="landing">
      {/* Hero Section */}
      <section className="landing-hero">
        {/* Animated background orbs */}
        <div className="landing-orb landing-orb-1" />
        <div className="landing-orb landing-orb-2" />
        <div className="landing-orb landing-orb-3" />

        <div className="landing-hero-content animate-fade-in-up">
          {/* Main CTA input */}
          <form className="landing-cta" onSubmit={handleSubmit}>
            <div className="landing-input-wrapper">
              <FolderGit2 size={18} className="landing-input-icon" />
              <input
                className="landing-input"
                type="text"
                placeholder="Paste a GitHub URL — e.g. https://github.com/facebook/react"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={loading}
                id="landing-repo-url"
              />
              <button
                className="btn btn-primary landing-submit-btn"
                type="submit"
                disabled={loading || !repoUrl.trim()}
                id="landing-submit-btn"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                {loading ? "Indexing…" : "Start"}
              </button>
            </div>
            {error && <p className="landing-error">{error}</p>}
          </form>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <div className="landing-feature-grid">
          <div className="landing-feature-card glass animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <div className="landing-feature-icon-wrapper">
              <Search size={22} />
            </div>
            <h3 className="landing-feature-title">Semantic Search</h3>
            <p className="landing-feature-desc">
              Code is chunked, embedded, and stored in a vector database for context-aware retrieval.
            </p>
          </div>

          <div className="landing-feature-card glass animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <div className="landing-feature-icon-wrapper">
              <MessageSquare size={22} />
            </div>
            <h3 className="landing-feature-title">Conversational AI</h3>
            <p className="landing-feature-desc">
              Ask follow-up questions. Chat history provides context for deeper, multi-turn conversations.
            </p>
          </div>

          <div className="landing-feature-card glass animate-fade-in-up" style={{ animationDelay: "300ms" }}>
            <div className="landing-feature-icon-wrapper">
              <Code2 size={22} />
            </div>
            <h3 className="landing-feature-title">Source References</h3>
            <p className="landing-feature-desc">
              Every answer includes exact file paths and line numbers, so you can verify and navigate with confidence.
            </p>
          </div>

          <div className="landing-feature-card glass animate-fade-in-up" style={{ animationDelay: "400ms" }}>
            <div className="landing-feature-icon-wrapper">
              <GitBranch size={22} />
            </div>
            <h3 className="landing-feature-title">GitHub Integration</h3>
            <p className="landing-feature-desc">
              Paste any public GitHub URL. CodeMind fetches, filters, and indexes the relevant source files automatically.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-how">
        <h2 className="landing-section-title">How it works</h2>
        <div className="landing-steps">
          <div className="landing-step">
            <div className="landing-step-number">1</div>
            <div className="landing-step-content">
              <h4>Paste a GitHub URL</h4>
              <p>Any public repository. We'll fetch the file tree and source code.</p>
            </div>
          </div>
          <div className="landing-step-connector" />
          <div className="landing-step">
            <div className="landing-step-number">2</div>
            <div className="landing-step-content">
              <h4>Automatic Indexing</h4>
              <p>Files are chunked with language-aware splitters, embedded, and stored in Qdrant.</p>
            </div>
          </div>
          <div className="landing-step-connector" />
          <div className="landing-step">
            <div className="landing-step-number">3</div>
            <div className="landing-step-content">
              <h4>Ask Questions</h4>
              <p>Natural-language queries are matched against the vector store for grounded, accurate answers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <Brain size={16} />
          <span>CodeMind — Built with LangChain, Qdrant, and OpenAI</span>
        </div>
      </footer>
    </div>
  );
}
