import { useEffect } from "react";
import { useParams, Link } from "wouter";
import { ChevronLeft, Check, Loader2 } from "lucide-react";
import { useProject, useProcessStep, useApproveStep, useRedoStep, useSubmitStep } from "@/hooks/use-projects";
import { useChat } from "@/hooks/use-chat";
import { AIChatPanel } from "@/components/chat/AIChatPanel";
import { Step1DataCollection } from "@/components/steps/Step1DataCollection";
import { Step2Analysis } from "@/components/steps/Step2Analysis";
import { Step3CAD } from "@/components/steps/Step3CAD";
import { Step4Model3D } from "@/components/steps/Step4Model3D";
import { Step5Interior } from "@/components/steps/Step5Interior";
import { Step6Render } from "@/components/steps/Step6Render";
import { Step7PDF } from "@/components/steps/Step7PDF";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Project } from "@shared/schema";

const STEPS = [
  { num: 1, label: "Thu thập", icon: "📋" },
  { num: 2, label: "Phân tích", icon: "🔍" },
  { num: 3, label: "CAD", icon: "📐" },
  { num: 4, label: "3D", icon: "🏠" },
  { num: 5, label: "Nội thất", icon: "🪑" },
  { num: 6, label: "Render", icon: "🎨" },
  { num: 7, label: "PDF", icon: "📄" },
];

const STEP_PROMPTS: Record<number, string> = {
  1: "Chào bạn! Hãy cho tôi biết thêm về yêu cầu thiết kế. Bạn có yêu cầu đặc biệt về phong thủy, phòng thờ, gara xe không?",
  2: "Tôi sẽ phân tích hiện trạng khu đất. Bạn có thông tin gì thêm về hướng nhà, hàng xóm, hay điều kiện đặc biệt không?",
  3: "Bản vẽ CAD sẽ được tạo từ layout đã duyệt. Bạn muốn chỉnh sửa gì về vị trí cửa, cầu thang không?",
  4: "Hãy cho tôi biết phong cách mặt tiền bạn yêu thích và tông màu mong muốn.",
  5: "Bạn muốn nội thất phong cách nào? Cho tôi biết về vật liệu và đồ nội thất ưa thích.",
  6: "Tôi sẽ render các góc nhìn. Bạn muốn xem góc nào đặc biệt?",
  7: "Hồ sơ PDF sẽ tổng hợp mọi thứ. Bạn muốn thêm nội dung gì không?",
};

export default function ProjectWizard() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id);
  const { data: project, isLoading } = useProject(projectId);
  const processStep = useProcessStep();
  const approveStep = useApproveStep();
  const redoStep = useRedoStep();
  const submitStep = useSubmitStep();
  const { messages, isLoading: chatLoading, sendMessage, addSystemMessage, loadHistory } = useChat(projectId);

  useEffect(() => {
    if (project && messages.length === 0) {
      const step = project.currentStep;
      const history = (project.chatHistory as Array<{role: "user" | "assistant" | "system"; content: string; timestamp: string}>) || [];
      if (history.length > 0) {
        loadHistory(history);
        return;
      }
      const prompt = STEP_PROMPTS[step];
      if (prompt) {
        addSystemMessage(prompt);
      }
    }
  }, [project?.id]);

  if (isLoading || !project) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-16 w-full mb-6 rounded-xl" />
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3"><Skeleton className="h-96 rounded-xl" /></div>
          <div className="col-span-2"><Skeleton className="h-96 rounded-xl" /></div>
        </div>
      </div>
    );
  }

  const currentStep = project.currentStep;
  const statuses = (project.stepStatuses || {}) as Record<string, string>;
  const currentStatus = statuses[currentStep] || "pending";

  const getStepStatus = (step: number) => statuses[step] || "pending";

  const handleProcess = (step: number) => {
    processStep.mutate({ projectId, step });
  };

  const handleApprove = (step: number) => {
    approveStep.mutate({ projectId, step });
  };

  const handleRedo = (step: number) => {
    redoStep.mutate({ projectId, step });
  };

  const handleSubmit = (step: number, data: Record<string, unknown>) => {
    submitStep.mutate({ projectId, step, data });
  };

  const stepProps = (step: number) => ({
    project: project as Project,
    stepStatus: getStepStatus(step),
    onProcess: () => handleProcess(step),
    onApprove: () => handleApprove(step),
    onRedo: () => handleRedo(step),
    isProcessing: processStep.isPending,
    isApproving: approveStep.isPending,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="project-wizard">
      <header className="h-14 border-b border-border/50 bg-white/80 backdrop-blur px-4 flex items-center gap-4 sticky top-0 z-50">
        <Link href="/">
          <Button variant="ghost" size="sm" className="rounded-lg gap-1.5" data-testid="button-back">
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-foreground text-sm" data-testid="text-project-title">{project.title}</h1>
          {project.clientName && <p className="text-xs text-muted-foreground">KH: {project.clientName}</p>}
        </div>
        {project.status === "completed" && (
          <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full" data-testid="badge-completed">Hoàn thành</span>
        )}
      </header>

      <div className="px-4 py-3 bg-white/60 border-b border-border/30">
        <div className="flex items-center gap-1 max-w-4xl mx-auto">
          {STEPS.map((step, i) => {
            const status = getStepStatus(step.num);
            const isCurrent = step.num === currentStep;
            const isCompleted = status === "approved";
            const isAccessible = step.num <= currentStep;

            return (
              <div key={step.num} className="flex items-center flex-1">
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all w-full justify-center",
                  isCurrent && "bg-primary text-white shadow-md shadow-primary/25",
                  isCompleted && !isCurrent && "bg-green-100 text-green-700",
                  !isCurrent && !isCompleted && isAccessible && "bg-slate-100 text-slate-600",
                  !isAccessible && "bg-slate-50 text-slate-400"
                )} data-testid={`stepper-step-${step.num}`}>
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : <span>{step.icon}</span>}
                  <span className="hidden lg:inline">{step.label}</span>
                  <span className="lg:hidden">{step.num}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-0.5 w-4 shrink-0 mx-0.5", isCompleted ? "bg-green-300" : "bg-slate-200")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 overflow-y-auto p-6" style={{ flex: "0 0 60%" }}>
          {currentStep === 1 && <Step1DataCollection {...stepProps(1)} onSubmit={(data) => handleSubmit(1, data)} />}
          {currentStep === 2 && <Step2Analysis {...stepProps(2)} />}
          {currentStep === 3 && <Step3CAD {...stepProps(3)} />}
          {currentStep === 4 && <Step4Model3D {...stepProps(4)} onSubmit={(data) => handleSubmit(4, data)} />}
          {currentStep === 5 && <Step5Interior {...stepProps(5)} />}
          {currentStep === 6 && <Step6Render {...stepProps(6)} />}
          {currentStep === 7 && <Step7PDF {...stepProps(7)} />}

          {project.status === "completed" && currentStep >= 7 && getStepStatus(7) === "approved" && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <h2 className="text-xl font-bold text-green-700 mb-2">Dự án hoàn thành!</h2>
              <p className="text-green-600">Tất cả 7 bước đã được duyệt. Hồ sơ PDF đã sẵn sàng tải xuống.</p>
            </div>
          )}
        </div>

        <div className="border-l border-border/50 flex flex-col" style={{ flex: "0 0 40%" }}>
          <AIChatPanel
            messages={messages}
            isLoading={chatLoading}
            onSendMessage={(msg) => sendMessage(msg, currentStep)}
          />
        </div>
      </div>
    </div>
  );
}
