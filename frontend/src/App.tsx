import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useCallback } from "react";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import ChatPage from "./pages/ChatPage";
import type { Repository } from "./api/client";

function App() {
  const [activeRepo, setActiveRepo] = useState<Repository | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleRepoSelect = useCallback((repo: Repository) => {
    setActiveRepo(repo);
    setSessionId(null);
  }, []);

  return (
    <Routes>
      <Route element={<Layout activeRepo={activeRepo} onRepoSelect={handleRepoSelect} />}>
        <Route index element={<LandingPage onRepoSelect={handleRepoSelect} />} />
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
    </Routes>
  );
}

export default App;
