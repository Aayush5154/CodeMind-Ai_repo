import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./AuthPage.css";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
        if (mode === "register") {
          if (!name.trim()) {
            throw new Error("Name is required");
          }
          await register(name.trim(), email.trim(), password);
        } else {
          await login(email.trim(), password);
        }
        navigate("/");
      } catch (err: any) {
        setError(err.message || "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [mode, name, email, password, login, register, navigate]
  );

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
  };

  return (
    <div className="auth">
      {/* Decorative background */}
      <div className="auth-bg">
        <div className="auth-bg-shape auth-bg-shape-1" />
        <div className="auth-bg-shape auth-bg-shape-2" />
      </div>

      <div className="auth-container animate-fade-in-up">
        {/* Logo / Brand */}
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <Brain size={28} />
          </div>
          <h1 className="auth-brand-name">CodeMind</h1>
          <p className="auth-brand-tagline">AI-Powered Codebase Intelligence</p>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="auth-card-desc">
              {mode === "login"
                ? "Sign in to access your indexed repositories"
                : "Get started with CodeMind in seconds"}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-name">
                  Full Name
                </label>
                <div className="auth-input-wrapper">
                  <User size={16} className="auth-input-icon" />
                  <input
                    id="auth-name"
                    className="auth-input"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">
                Email Address
              </label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="auth-email"
                  className="auth-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-password">
                Password
              </label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="auth-password"
                  className="auth-input"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    mode === "register" ? "Min. 6 characters" : "••••••••"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error animate-fade-in">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={loading || !email.trim() || !password}
              id="auth-submit-btn"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ArrowRight size={18} />
              )}
              {loading
                ? mode === "register"
                  ? "Creating account…"
                  : "Signing in…"
                : mode === "register"
                ? "Create Account"
                : "Sign In"}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <p className="auth-switch">
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              className="auth-switch-btn"
              onClick={toggleMode}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="auth-footer">
          Built with LangChain, Qdrant, and OpenAI
        </p>
      </div>
    </div>
  );
}
