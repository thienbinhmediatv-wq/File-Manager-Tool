import { useState, useCallback, useEffect, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  searchResults?: Array<{ title: string; link: string; snippet: string }>;
  emailSent?: boolean;
  emailResult?: { success: boolean; message: string };
}

interface ProjectData {
  landWidth?: number;
  landLength?: number;
  floors?: number;
  bedrooms?: number;
  bathrooms?: number;
  style?: string;
  budget?: number;
  selectedArchitecture?: { name: string; image: string } | null;
  selectedInteriorStyle?: string;
}

const AUTO_GREETING = "Xin chào! Tôi là trợ lý thiết kế BMT Decor. Tôi có thể giúp bạn điền thông tin dự án hoặc gợi ý thiết kế.";

const STEP_GUIDANCE: Record<number, string> = {
  1: "Bạn đang ở bước Thu thập dữ liệu. Hãy điền đầy đủ thông tin kích thước đất, số tầng và phòng. Tôi có thể gợi ý bố trí phù hợp nếu bạn cần!",
  2: "Bước Phân tích đã bắt đầu! AI đang phân tích hiện trạng khu đất của bạn. Nếu bạn có thông tin về hướng nhà hoặc điều kiện đặc biệt, hãy cho tôi biết.",
  3: "Bản vẽ CAD sẽ được tạo. Bạn có muốn chỉnh sửa vị trí cửa, cầu thang hay phòng nào không? Tôi có thể tư vấn thêm.",
  4: "Mô hình 3D đang được xử lý. Hãy cho tôi biết phong cách mặt tiền bạn yêu thích và tông màu mong muốn!",
  5: "Thiết kế nội thất bắt đầu! Cho tôi biết về vật liệu và đồ nội thất ưa thích. Tôi có thể gợi ý phù hợp với phong cách đã chọn.",
  6: "Render các góc nhìn đang được tạo. Tôi khuyên bạn nên xem ít nhất 3 góc: mặt trước, phối cảnh, và sân vườn. Bạn muốn thêm góc nào?",
  7: "Hồ sơ PDF sẽ tổng hợp mọi thứ. Bạn muốn thêm nội dung gì? Cho tôi email hoặc số điện thoại để gửi file PDF cho bạn!",
};

const IDLE_TIPS: Record<number, string[]> = {
  1: [
    "Mẹo: Kích thước đất lý tưởng cho nhà phố là từ 4m x 15m trở lên. Bạn cần tư vấn thêm không?",
    "Bạn có biết? Nhà 2 tầng là lựa chọn phổ biến nhất cho gia đình 4-5 người với chi phí tối ưu.",
  ],
  2: [
    "Mẹo: Hướng Đông Nam thường được ưa chuộng vì đón nắng sớm và tránh nắng chiều.",
    "Bạn có thể upload ảnh khu đất để AI phân tích tốt hơn nhé!",
  ],
  3: [
    "Mẹo: Cầu thang nên đặt ở vị trí trung tâm để tiết kiệm diện tích và thuận tiện di chuyển.",
    "Bạn muốn thêm ban công ở tầng nào? Cho tôi biết để tôi gợi ý vị trí phù hợp.",
  ],
  4: [
    "Mẹo: Phong cách Modern đang rất thịnh hành với đường nét tối giản và vật liệu hiện đại.",
    "Tông màu trung tính (trắng, xám, be) giúp ngôi nhà trông sang trọng và dễ phối đồ nội thất.",
  ],
  5: [
    "Mẹo: Sàn gỗ công nghiệp là lựa chọn tốt cho phòng khách - vừa đẹp vừa dễ bảo trì.",
    "Phong cách Scandinavian kết hợp tốt với ánh sáng tự nhiên. Bạn có muốn thêm cửa kính lớn?",
  ],
  6: [
    "Mẹo: Ít nhất 3 góc render (mặt trước, phối cảnh, nội thất) sẽ giúp bạn hình dung rõ hơn.",
    "Render ban đêm cũng rất ấn tượng! Bạn có muốn thêm góc nhìn buổi tối không?",
  ],
  7: [
    "Mẹo: File PDF sẽ bao gồm tất cả bản vẽ, render và thông số kỹ thuật.",
    "Cho tôi email hoặc số điện thoại để gửi file PDF hoàn chỉnh cho bạn nhé!",
  ],
};

function getFormReactions(data: ProjectData): string | null {
  if (data.floors && data.bedrooms) {
    if (data.floors === 1 && data.bedrooms > 4) {
      return "⚠️ Lưu ý: Với nhà 1 tầng, bố trí hơn 4 phòng ngủ sẽ khá chật. Tôi gợi ý nên xem xét thêm tầng hoặc giảm số phòng ngủ để đảm bảo không gian sống thoải mái.";
    }
    if (data.floors === 1 && data.bedrooms > 3) {
      return "💡 Gợi ý: Nhà 1 tầng với " + data.bedrooms + " phòng ngủ cần diện tích đất khá lớn. Bạn có cân nhắc thêm tầng không?";
    }
    if (data.floors === 2 && data.bedrooms > 6) {
      return "⚠️ Lưu ý: " + data.bedrooms + " phòng ngủ cho nhà 2 tầng sẽ cần khu đất rộng. Hãy đảm bảo diện tích đất đủ lớn nhé!";
    }
  }

  if (data.landWidth && data.landLength && data.floors) {
    const area = data.landWidth * data.landLength;
    if (area < 50 && data.floors === 1) {
      return "💡 Với diện tích " + area + "m² và chỉ 1 tầng, không gian sẽ hạn chế. Tôi gợi ý xây thêm tầng để tối ưu diện tích sử dụng.";
    }
  }

  if (data.style) {
    const styleReactions: Record<string, string> = {
      "Modern": "🏗️ Phong cách Modern: Tôi gợi ý dùng kính cường lực, thép và bê tông trần. Màu sắc chủ đạo: trắng, xám, đen.",
      "Industrial": "🏭 Phong cách Industrial: Vật liệu gợi ý gồm gạch trần, ống thép lộ, và sàn bê tông đánh bóng. Rất cá tính!",
      "Scandinavian": "🌿 Phong cách Scandinavian: Nên dùng gỗ sáng màu, vải linen tự nhiên và tông trắng kem. Cần nhiều ánh sáng tự nhiên!",
      "Minimalist": "✨ Phong cách Minimalist: Ít đồ đạc nhưng chất lượng cao. Gam màu đơn sắc, đường nét gọn gàng.",
      "Indochine": "🏮 Phong cách Indochine: Kết hợp gỗ tự nhiên tối màu, gạch bông, và các chi tiết Á Đông tinh tế.",
      "Neoclassic": "🏛️ Phong cách Neoclassic: Cần chú ý phào chỉ, trần thạch cao trang trí và đèn chùm pha lê.",
      "Tropical": "🌴 Phong cách Tropical: Cây xanh, vật liệu tự nhiên và không gian mở là chìa khóa. Rất phù hợp khí hậu Việt Nam!",
      "Wabi Sabi": "🍃 Phong cách Wabi Sabi: Tôn vinh vẻ đẹp tự nhiên với vật liệu thô mộc, gốm sứ thủ công và gam màu đất.",
    };
    if (styleReactions[data.style]) {
      return styleReactions[data.style];
    }
  }

  if (data.budget && data.floors) {
    const totalArea = (data.landWidth || 5) * (data.landLength || 15) * data.floors;
    const costPerSqm = (data.budget * 1000000) / totalArea;
    if (costPerSqm < 3500000) {
      return "💰 Lưu ý: Với ngân sách " + data.budget + " triệu cho " + totalArea.toFixed(0) + "m² sử dụng, chi phí khoảng " + (costPerSqm / 1000000).toFixed(1) + " triệu/m² - hơi thấp so với thị trường. Tôi gợi ý tối ưu vật liệu hoặc tăng ngân sách.";
    }
  }

  return null;
}

export function useChat(projectId: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const greetingSent = useRef(false);
  const lastStep = useRef<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTipIndex = useRef<Record<number, number>>({});
  const lastReactionKey = useRef<string>("");

  const addAssistantMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { role: "assistant", content, timestamp: new Date().toISOString() }]);
    setChatOpen(open => {
      if (!open) setUnreadCount(prev => prev + 1);
      return open;
    });
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { role: "system", content, timestamp: new Date().toISOString() }]);
  }, []);

  const markRead = useCallback(() => {
    setUnreadCount(0);
    setChatOpen(true);
  }, []);

  const markClosed = useCallback(() => {
    setChatOpen(false);
  }, []);

  useEffect(() => {
    if (greetingSent.current) return;
    greetingSent.current = true;
    const timer = setTimeout(() => {
      addAssistantMessage(AUTO_GREETING);
    }, 4000);
    return () => clearTimeout(timer);
  }, [addAssistantMessage]);

  const sendStepGuidance = useCallback((step: number) => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    const guidance = STEP_GUIDANCE[step];
    if (guidance) {
      addAssistantMessage(guidance);
    }
  }, [addAssistantMessage]);

  const resetIdleTimer = useCallback((currentStep: number) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      const tips = IDLE_TIPS[currentStep];
      if (!tips || tips.length === 0) return;
      const idx = idleTipIndex.current[currentStep] || 0;
      addAssistantMessage(tips[idx % tips.length]);
      idleTipIndex.current[currentStep] = idx + 1;
    }, 10000);
  }, [addAssistantMessage]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const checkFormReactions = useCallback((data: ProjectData) => {
    const key = JSON.stringify(data);
    if (key === lastReactionKey.current) return;
    lastReactionKey.current = key;
    const reaction = getFormReactions(data);
    if (reaction) {
      addAssistantMessage(reaction);
    }
  }, [addAssistantMessage]);

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

      const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
      const phoneMatch = message.match(/(?:\+84|0)\d{9,10}/);

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

      if (data.approveResult?.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      }

      if (emailMatch || phoneMatch) {
        const contact = emailMatch ? emailMatch[0] : phoneMatch![0];
        setTimeout(() => {
          addAssistantMessage(`Cảm ơn bạn! Tôi đã ghi nhận thông tin liên hệ: ${contact}. File PDF sẽ được gửi đến bạn khi hoàn thành.`);
        }, 1000);
      }

      return data.reply;
    } catch {
      const errMsg: ChatMessage = { role: "assistant", content: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.", timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, addAssistantMessage]);

  const loadHistory = useCallback((history: ChatMessage[]) => {
    if (history && history.length > 0) {
      setMessages(history);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    unreadCount,
    sendMessage,
    addSystemMessage,
    addAssistantMessage,
    loadHistory,
    clearMessages,
    markRead,
    markClosed,
    sendStepGuidance,
    resetIdleTimer,
    checkFormReactions,
  };
}
