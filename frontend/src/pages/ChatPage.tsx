import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Loader2,
  FileCode2,
  Bot,
  User,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { askQuestion, type Repository, type Source } from "../api/client";
import "./ChatPage.css";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
}

interface ChatPageProps {
  repository: Repository;
  sessionId: string | null;
  onSessionCreated: (sessionId: string) => void;
}

export default function ChatPage({
  repository,
  sessionId,
  onSessionCreated,
}: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset messages when repo changes
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [repository._id]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setError(null);

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Add streaming placeholder
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      },
    ]);

    setLoading(true);

    try {
      const res = await askQuestion(repository._id, question, sessionId || undefined);

      // Update session ID
      if (!sessionId && res.data.sessionId) {
        onSessionCreated(res.data.sessionId);
      }

      // Replace streaming placeholder with real answer
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: res.data.answer,
                sources: res.data.sources,
                isStreaming: false,
              }
            : msg
        )
      );
    } catch (err: any) {
      setError(err.message || "Failed to get response");
      // Remove streaming placeholder
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));
    } finally {
      setLoading(false);
    }
  }, [input, loading, repository._id, sessionId, onSessionCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const isProcessing = repository.status === "processing";

  return (
    <div className="chat">
      {/* Chat Header */}
      <header className="chat-header glass-strong">
        <div className="chat-header-info">
          <h2 className="chat-header-title">
            {repository.owner}/{repository.name}
          </h2>
          <span className="chat-header-meta">
            {isProcessing
              ? "Indexing in progress…"
              : `${repository.filesProcessed} files · ${repository.chunksCreated} chunks · ${repository.branch}`}
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty animate-fade-in-up">
            <div className="chat-empty-icon">
              <Sparkles size={32} />
            </div>
            <h3 className="chat-empty-title">Ask anything about this codebase</h3>
            <p className="chat-empty-desc">
              CodeMind has indexed{" "}
              <strong>{repository.filesProcessed} files</strong> from{" "}
              <strong>
                {repository.owner}/{repository.name}
              </strong>
              . Ask about architecture, specific functions, data flow, or anything else.
            </p>

            <div className="chat-suggestions">
              {[
                "What is the overall architecture of this project?",
                "What are the main entry points?",
                "How does error handling work?",
                "Explain the data models used.",
              ].map((q) => (
                <button
                  key={q}
                  className="chat-suggestion-chip"
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message chat-message-${msg.role} animate-fade-in-up`}
          >
            <div className="chat-message-avatar">
              {msg.role === "user" ? (
                <User size={16} />
              ) : (
                <Bot size={16} />
              )}
            </div>
            <div className="chat-message-content">
              {msg.isStreaming ? (
                <div className="chat-typing">
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                  <span className="chat-typing-dot" />
                </div>
              ) : msg.role === "assistant" ? (
                <>
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="chat-sources">
                      <span className="chat-sources-label">Sources:</span>
                      <div className="chat-sources-list">
                        {msg.sources.map((src, i) => (
                          <span key={i} className="chat-source-chip">
                            <FileCode2 size={12} />
                            <span>{src.filePath}</span>
                            {src.startLine && src.endLine && (
                              <span className="chat-source-lines">
                                L{src.startLine}–{src.endLine}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="chat-error animate-fade-in-up">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper glass-strong">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={
              isProcessing
                ? "Repository is still being indexed…"
                : "Ask a question about this codebase…"
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={loading || isProcessing}
            rows={1}
            id="chat-input"
          />
          <button
            className="btn btn-primary btn-icon chat-send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim() || isProcessing}
            id="chat-send-btn"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="chat-input-hint">
          Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}
