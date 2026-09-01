import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Code2,
  ArrowRight,
  FolderGit2,
  Loader2,
  Sun,
} from "lucide-react";
import {
  indexRepository,
  getRepositoryStatus,
  type Repository,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./LandingPage.css";

interface LandingPageProps {
  onRepoSelect: (repo: Repository) => void;
}

export default function LandingPage({ onRepoSelect }: LandingPageProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
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
      {/* Top Navbar */}
      <header className="landing-topbar">
        <form className="landing-topbar-search" onSubmit={handleSubmit}>
          <FolderGit2 size={18} className="landing-topbar-icon" />
          <input
            className="landing-topbar-input"
            type="text"
            placeholder="Paste a GitHub URL (e.g. https://github.com/username/repo)"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={loading}
          />
          <button
            className="landing-topbar-btn"
            type="submit"
            disabled={loading || !repoUrl.trim()}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {loading ? "Indexing…" : "Start"}
          </button>
        </form>
        {error && <p className="landing-topbar-error">{error}</p>}
        
        <div className="landing-topbar-actions">
          <button className="landing-topbar-action-btn"><Sun size={20} /></button>
          <div className="landing-topbar-avatar">{user?.name?.charAt(0).toUpperCase() || "U"}</div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="landing-main-content">
        {/* Welcome Card */}
        <section className="welcome-card animate-fade-in-up">
          <div className="welcome-card-content">
            <div className="welcome-badge">
              <Sparkles size={14} />
              <span>RAG-Powered</span>
            </div>
            <h1 className="welcome-title">
              Welcome back, <br/>{user?.name?.split(" ")[0] || "User"} 👋
            </h1>
            <p className="welcome-subtitle">
              CodeMind helps you understand any codebase using the power of AI.
            </p>
          </div>
          <div className="welcome-illustration">
            {/* CSS Illustration mimicking the screenshot */}
            <div className="illust-window">
              <div className="illust-dots">
                <div className="illust-dot"></div>
                <div className="illust-dot"></div>
                <div className="illust-dot"></div>
              </div>
              <div className="illust-lines">
                <div className="illust-line-group">
                  <span className="illust-num">1</span>
                  <div className="illust-bar green-light"></div>
                  <div className="illust-bar gray-light"></div>
                </div>
                <div className="illust-line-group">
                  <span className="illust-num">3</span>
                  <div className="illust-bar green-strong"></div>
                  <div className="illust-bar gray-medium"></div>
                </div>
                <div className="illust-line-group">
                  <span className="illust-num">4</span>
                  <div className="illust-bar green-light"></div>
                  <div className="illust-bar gray-light"></div>
                </div>
                <div className="illust-line-group">
                  <span className="illust-num">5</span>
                  <div className="illust-bar purple-light"></div>
                  <div className="illust-bar gray-light"></div>
                </div>
              </div>
            </div>
            {/* Floating badges */}
            <div className="illust-badge badge-code">
              <Code2 size={18} />
            </div>
            <div className="illust-badge badge-brain">
              <img src="/logo.png" alt="CodeMind" className="illust-badge-logo" />
            </div>
          </div>
        </section>

      {/* Features */}
      <section className="landing-features">
        <div className="landing-feature-grid">
          <div className="landing-feature-card animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <h3 className="landing-feature-title">Semantic Search</h3>
            <p className="landing-feature-desc">
              Find relevant code, functions, and concepts using natural language queries.
            </p>
            <div className="landing-feature-arrow"><ArrowRight size={16} /></div>
          </div>

          <div className="landing-feature-card animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <h3 className="landing-feature-title">Conversational AI</h3>
            <p className="landing-feature-desc">
              Ask follow-up questions and get context-aware answers about your codebase.
            </p>
            <div className="landing-feature-arrow"><ArrowRight size={16} /></div>
          </div>

          <div className="landing-feature-card animate-fade-in-up" style={{ animationDelay: "300ms" }}>
            <h3 className="landing-feature-title">Source References</h3>
            <p className="landing-feature-desc">
              Every answer comes with accurate file paths and line numbers you can trust.
            </p>
            <div className="landing-feature-arrow"><ArrowRight size={16} /></div>
          </div>

          <div className="landing-feature-card animate-fade-in-up" style={{ animationDelay: "400ms" }}>
            <h3 className="landing-feature-title">GitHub Integration</h3>
            <p className="landing-feature-desc">
              Connect any public GitHub repository and let CodeMind index it automatically.
            </p>
            <div className="landing-feature-arrow"><ArrowRight size={16} /></div>
          </div>
        </div>
      </section>
      </div>


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
          <img src="/logo.png" alt="CodeMind" className="landing-footer-logo" />
          <span>CodeMind — Built with LangChain, Qdrant, and OpenAI</span>
        </div>
      </footer>
    </div>
  );
}
