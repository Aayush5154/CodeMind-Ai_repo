import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.tsx";
import type { Repository } from "../api/client";
import "./Layout.css";

interface LayoutProps {
  activeRepo: Repository | null;
  onRepoSelect: (repo: Repository) => void;
}

export default function Layout({ activeRepo, onRepoSelect }: LayoutProps) {
  return (
    <div className="layout">
      <Sidebar activeRepo={activeRepo} onRepoSelect={onRepoSelect} />
      <main className="layout-main">
        <div className="layout-glow" />
        <Outlet />
      </main>
    </div>
  );
}
