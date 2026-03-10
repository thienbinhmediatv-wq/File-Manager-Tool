import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

interface AIChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
}

export function AIChatPanel({ messages, isLoading, onSendMessage }: AIChatPanelProps) {
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
    <div className="flex flex-col h-full bg-white/50 rounded-2xl border border-border/50 overflow-hidden" data-testid="chat-panel">
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2 bg-primary/5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">AI Trợ lý thiết kế</h3>
          <p className="text-xs text-muted-foreground">Bmt Decor AI</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-600 font-medium">Online</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-3 text-primary/30" />
            <p className="text-sm">Hỏi AI về thiết kế, phong cách, vật liệu...</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
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
                : "bg-slate-100 text-foreground rounded-bl-md"
            )} data-testid={`chat-message-${i}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                <User className="w-3.5 h-3.5 text-white" />
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
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
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
            placeholder="Nhập tin nhắn..."
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
