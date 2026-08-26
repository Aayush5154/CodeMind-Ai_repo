import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import ChatPage from "./pages/ChatPage";
import AuthPage from "./pages/AuthPage";
import type { Repository } from "./api/client";

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeRepo, setActiveRepo] = useState<Repository | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleRepoSelect = useCallback((repo: Repository) => {
    setActiveRepo(repo);
    setSessionId(null);
  }, []);

  // Show nothing while checking auth status
  if (isLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Auth page — public, redirects if already logged in */}
      <Route
        path="/auth"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />
        }
      />

      {/* Protected routes — redirect to /auth if not logged in */}
      <Route
        element={
          isAuthenticated ? (
            <Layout activeRepo={activeRepo} onRepoSelect={handleRepoSelect} />
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      >
        <Route
          index
          element={<LandingPage onRepoSelect={handleRepoSelect} />}
        />
        <Route
          path="/chat"
          element={
            activeRepo ? (
              <ChatPage
                repository={activeRepo}
                sessionId={sessionId}
                onSessionCreated={setSessionId}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
