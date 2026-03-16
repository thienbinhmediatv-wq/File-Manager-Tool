import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, MessageSquare, Globe, ExternalLink, Mail, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  searchResults?: Array<{ title: string; link: string; snippet: string }>;
  emailSent?: boolean;
  emailResult?: { success: boolean; message: string };
}

interface AIChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  compact?: boolean;
}

export function AIChatPanel({ messages, isLoading, onSendMessage, compact = false }: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || isLoading) return;
    setInput("");
    onSendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", !compact && "bg-white/50 rounded-2xl border border-border/50")} data-testid="chat-panel">
      {!compact && (
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2 bg-primary/5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Trợ lý thiết kế</h3>
            <p className="text-xs text-muted-foreground">Bmt Decor AI + Google Search + Drive Learning</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-green-600 font-medium">Online</span>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-3 text-primary/30" />
            <p className="text-sm">Hỏi AI về thiết kế, phong cách, vật liệu...</p>
            <p className="text-xs mt-1 text-muted-foreground/60">Paste Drive link hoặc hỏi bất cứ điều gì • AI sẽ tìm kiếm Google khi cần</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role !== "user" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-white rounded-br-md"
                  : msg.role === "system"
                  ? "bg-accent/10 text-accent-foreground border border-accent/20 italic rounded-bl-md"
                  : "bg-slate-100 text-slate-800 rounded-bl-md"
              )} data-testid={`chat-message-${i}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>

            {msg.searchResults && msg.searchResults.length > 0 && (
              <div className="ml-9 mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 mb-2">
                  <Globe className="w-3.5 h-3.5" /> Nguồn tham khảo từ internet
                </p>
                <div className="space-y-1.5">
                  {msg.searchResults.slice(0, 3).map((sr, j) => (
                    <a
                      key={j}
                      href={sr.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-1.5 text-xs hover:bg-blue-100 rounded-lg p-1.5 transition-colors group"
                      data-testid={`search-result-${i}-${j}`}
                    >
                      <ExternalLink className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-blue-700 group-hover:underline truncate">{sr.title}</p>
                        <p className="text-blue-600/70 line-clamp-1">{sr.snippet}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {msg.emailResult && (
              <div className={cn(
                "ml-9 mt-2 rounded-xl p-3 flex items-center gap-2",
                msg.emailResult.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              )} data-testid={`email-status-${i}`}>
                {msg.emailResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className={cn(
                    "text-xs font-medium",
                    msg.emailResult.success ? "text-green-700" : "text-red-700"
                  )}>
                    {msg.emailResult.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs text-slate-500">Đang tìm kiếm & phân tích...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border/50 bg-white/80">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi AI (tự tìm Google khi cần)..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="rounded-xl h-10 w-10 bg-primary hover:bg-primary/90 shrink-0"
            data-testid="button-send-chat"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
