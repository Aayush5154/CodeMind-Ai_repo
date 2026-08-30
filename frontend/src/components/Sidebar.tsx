import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  GitBranch,
  CheckCircle2,
  Loader2,
  FolderGit2,
  ArrowRight,
  Crown,
  AlertCircle,
  LogOut,
} from "lucide-react";
import {
  listRepositories,
  indexRepository,
  getRepositoryStatus,
  type Repository,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

interface SidebarProps {
  activeRepo: Repository | null;
  onRepoSelect: (repo: Repository) => void;
}

export default function Sidebar({ activeRepo, onRepoSelect }: SidebarProps) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const fetchRepos = useCallback(async () => {
    try {
      const res = await listRepositories();
      setRepos(res.data);
    } catch {
    }
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  useEffect(() => {
    const processingRepos = repos.filter((r) => r.status === "processing");
    if (processingRepos.length === 0) return;

    const interval = setInterval(async () => {
      let anyUpdated = false;
      for (const repo of processingRepos) {
        try {
          const res = await getRepositoryStatus(repo._id);
          if (res.data.status !== "processing") {
            anyUpdated = true;
            if (activeRepo?._id === repo._id) {
              onRepoSelect(res.data);
            }
          }
        } catch {
        }
      }
      if (anyUpdated) {
        fetchRepos();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [repos, fetchRepos, activeRepo?._id, onRepoSelect]);

  const handleAddRepo = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await indexRepository(repoUrl.trim());
      setRepoUrl("");
      setShowInput(false);
      await fetchRepos();

      const statusRes = await getRepositoryStatus(res.repositoryId);
      onRepoSelect(statusRes.data);
      navigate("/chat");
    } catch (err: any) {
      setError(err.message || "Failed to index repository");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepo = (repo: Repository) => {
    onRepoSelect(repo);
    navigate("/chat");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 size={14} />;
      case "processing":
        return <Loader2 size={14} className="animate-spin" />;
      case "failed":
        return <AlertCircle size={14} />;
      default:
        return <Loader2 size={14} />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "completed":
        return "badge-success";
      case "processing":
        return "badge-processing";
      case "failed":
        return "badge-error";
      default:
        return "badge-info";
    }
  };

  return (
    <aside className="sidebar glass-strong">
      <div className="sidebar-header">
        <button
          className="sidebar-logo-container"
          onClick={() => navigate("/")}
          aria-label="Go to home"
        >
          <img src="/logo.png" alt="CodeMind" className="sidebar-logo-img" />
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span className="sidebar-section-title">Repositories</span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => {
              setShowInput(!showInput);
              setError(null);
            }}
            title="Add repository"
            id="add-repo-btn"
          >
            <Plus size={16} />
          </button>
        </div>

        {showInput && (
          <div className="sidebar-add-repo animate-fade-in-up">
            <input
              className="input"
              type="text"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddRepo()}
              disabled={loading}
              autoFocus
              id="repo-url-input"
            />
            {error && <p className="sidebar-error">{error}</p>}
            <button
              className="btn btn-primary btn-sm sidebar-add-btn"
              onClick={handleAddRepo}
              disabled={loading || !repoUrl.trim()}
              id="index-repo-btn"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <FolderGit2 size={14} />}
              {loading ? "Indexing…" : "Index Repository"}
            </button>
          </div>
        )}

        <div className="sidebar-repo-list">
          {repos.length === 0 && !showInput && (
            <p className="sidebar-empty">No repositories indexed yet</p>
          )}

          {repos.map((repo) => (
            <button
              key={repo._id}
              className={`sidebar-repo-item ${
                activeRepo?._id === repo._id ? "active" : ""
              }`}
              onClick={() => handleSelectRepo(repo)}
              disabled={repo.status === "processing"}
              id={`repo-${repo._id}`}
            >
              <div className="sidebar-repo-info">
                <GitBranch size={14} className="sidebar-repo-icon" />
                <div className="sidebar-repo-text">
                  <span className="sidebar-repo-name">{repo.name}</span>
                  <span className="sidebar-repo-meta">
                    {repo.status === "completed"
                      ? `${repo.filesProcessed} files · ${repo.chunksCreated} chunks`
                      : repo.status === "failed"
                      ? repo.error || "Indexing failed"
                      : "Indexing…"}
                  </span>
                </div>
              </div>
              <span className={`badge ${getStatusClass(repo.status)}`}>
                {getStatusIcon(repo.status)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-plan">
        <div className="sidebar-plan-header">
          <span className="sidebar-plan-title">Your Plan</span>
          <span className="sidebar-plan-badge">Free</span>
        </div>
        <p className="sidebar-plan-usage">3 / 5 repositories used</p>
        <div className="sidebar-plan-progress">
          <div className="sidebar-plan-progress-bar" style={{ width: "60%" }} />
        </div>
        <button className="sidebar-plan-btn">
          <div className="sidebar-plan-btn-content">
            <Crown size={14} />
            <span>Upgrade Plan</span>
          </div>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="sidebar-footer-links">
        <button 
          className="sidebar-footer-link" 
          onClick={() => {
            logout();
            navigate("/auth");
          }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
