import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  searchResults?: Array<{ title: string; link: string; snippet: string }>;
  emailSent?: boolean;
  emailResult?: { success: boolean; message: string };
}

export function useChat(projectId: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { role: "system", content, timestamp: new Date().toISOString() }]);
  }, []);

  const sendMessage = useCallback(async (message: string, step?: number) => {
    const userMsg: ChatMessage = { role: "user", content: message, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const driveFileIdMatch = message.match(/\/d\/([a-zA-Z0-9-_]+)/);
      let enhancedMessage = message;
      
      if (driveFileIdMatch) {
        const fileId = driveFileIdMatch[1];
        try {
          const contentRes = await apiRequest("POST", "/api/drive-content", { fileId });
          const contentData = await contentRes.json();
          if (contentData.content) {
            enhancedMessage = `${message}\n\n[Drive File Content - ${fileId}]:\n${contentData.content}`;
          }
        } catch (e) {
          console.log("Could not fetch Drive content:", e);
        }
      }

      const res = await apiRequest("POST", "/api/chat", { projectId, message: enhancedMessage, step });
      const data = await res.json();
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString(),
        searchResults: data.searchResults,
        emailSent: data.emailSent,
        emailResult: data.emailResult,
      };
      setMessages(prev => [...prev, aiMsg]);
      return data.reply;
    } catch {
      const errMsg: ChatMessage = { role: "assistant", content: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.", timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const loadHistory = useCallback((history: ChatMessage[]) => {
    if (history && history.length > 0) {
      setMessages(history);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, addSystemMessage, loadHistory, clearMessages };
}
