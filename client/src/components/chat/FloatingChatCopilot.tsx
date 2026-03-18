import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X } from "lucide-react";
import { AIChatPanel } from "./AIChatPanel";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  searchResults?: Array<{ title: string; link: string; snippet: string }>;
  emailSent?: boolean;
  emailResult?: { success: boolean; message: string };
}

interface FloatingChatCopilotProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  unreadCount: number;
  currentStep?: number;
  onOpen?: () => void;
  onClose?: () => void;
}

export function FloatingChatCopilot({
  messages,
  isLoading,
  onSendMessage,
  unreadCount,
  currentStep,
  onOpen,
  onClose,
}: FloatingChatCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [bubblePos, setBubblePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const didDrag = useRef(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setBubblePos({ x: window.innerWidth - 76, y: window.innerHeight - 100 });
  }, []);

  const handleToggle = useCallback(() => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setIsOpen((prev) => {
      if (!prev && onOpen) onOpen();
      if (prev && onClose) onClose();
      return !prev;
    });
  }, [onOpen, onClose]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (onClose) onClose();
  }, [onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startPosX: bubblePos.x,
      startPosY: bubblePos.y,
    };
    didDrag.current = false;
    setIsDragging(true);
  }, [isMobile, bubblePos]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      didDrag.current = true;
    }
    const newX = Math.max(0, Math.min(window.innerWidth - 56, dragRef.current.startPosX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 56, dragRef.current.startPosY + dy));
    setBubblePos({ x: newX, y: newY });
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
    setBubblePos((prev) => {
      const midX = window.innerWidth / 2;
      return {
        x: prev.x < midX ? 16 : window.innerWidth - 72,
        y: prev.y,
      };
    });
  }, []);

  if (isMobile) {
    return (
      <>
        {!isOpen && (
          <button
            ref={bubbleRef}
            className={cn(
              "fixed z-[60] w-14 h-14 rounded-full bg-primary text-white shadow-xl flex items-center justify-center transition-shadow",
              isDragging ? "shadow-2xl scale-110" : "shadow-lg hover:shadow-xl"
            )}
            style={{ left: bubblePos.x, top: bubblePos.y, touchAction: "none" }}
            onClick={handleToggle}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            data-testid="button-chat-bubble"
          >
            <MessageSquare className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-pulse" data-testid="badge-unread">
                {unreadCount}
              </span>
            )}
          </button>
        )}

        {isOpen && (
          <div className="fixed inset-0 z-[70] animate-in slide-in-from-bottom duration-300 flex flex-col" data-testid="mobile-chat-panel">
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-primary/5 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">BMT Decor AI</span>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                  data-testid="button-close-mobile-chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <AIChatPanel
                  messages={messages}
                  isLoading={isLoading}
                  onSendMessage={onSendMessage}
                  compact
                  allowFileUpload={currentStep === 3}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={handleToggle}
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          data-testid="button-chat-desktop"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-sm font-semibold">BMT Decor AI</span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse" data-testid="badge-unread">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-[60] w-[380px] h-[520px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200"
          data-testid="desktop-chat-popup"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-primary/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="font-semibold text-sm block">BMT Decor AI</span>
                <span className="text-xs text-muted-foreground">Trợ lý thiết kế thông minh</span>
              </div>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1" />
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
              data-testid="button-close-desktop-chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <AIChatPanel
              messages={messages}
              isLoading={isLoading}
              onSendMessage={onSendMessage}
              compact
              allowFileUpload={currentStep === 3}
            />
          </div>
        </div>
      )}
    </>
  );
}
