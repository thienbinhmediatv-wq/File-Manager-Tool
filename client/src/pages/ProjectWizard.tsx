import { useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ChevronLeft, Check, Camera, Ruler, Layout, Box, Sofa, Image, FileText } from "lucide-react";
import { useProject, useProcessStep, useApproveStep, useRedoStep, useSubmitStep } from "@/hooks/use-projects";
import { useChat } from "@/hooks/use-chat";
import { FloatingChatCopilot } from "@/components/chat/FloatingChatCopilot";
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
import logoImg from "@assets/logo_nobg.png";

const STEPS = [
  { num: 1, label: "Thu thập", shortLabel: "1", icon: Camera },
  { num: 2, label: "Phân tích", shortLabel: "2", icon: Ruler },
  { num: 3, label: "CAD", shortLabel: "3", icon: Layout },
  { num: 4, label: "3D", shortLabel: "4", icon: Box },
  { num: 5, label: "Nội thất", shortLabel: "5", icon: Sofa },
  { num: 6, label: "Render", shortLabel: "6", icon: Image },
  { num: 7, label: "PDF", shortLabel: "7", icon: FileText },
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
  const {
    messages,
    isLoading: chatLoading,
    unreadCount,
    sendMessage,
    addSystemMessage,
    loadHistory,
    markRead,
    markClosed,
    sendStepGuidance,
    resetIdleTimer,
    checkFormReactions,
  } = useChat(projectId);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (project && messages.length === 0) {
      const step = project.currentStep;
      const history = (project.chatHistory as Array<{role: "user" | "assistant" | "system"; content: string; timestamp: string}>) || [];
      if (history.length > 0) {
        loadHistory(history);
        return;
      }
      const prompt = STEP_PROMPTS[step];
      if (prompt) addSystemMessage(prompt);
    }
  }, [project?.id]);

  const currentStep = project?.currentStep || 1;

  useEffect(() => {
    if (project) {
      sendStepGuidance(currentStep);
    }
  }, [currentStep, project?.id, sendStepGuidance]);

  useEffect(() => {
    if (!project) return;
    checkFormReactions({
      landWidth: project.landWidth,
      landLength: project.landLength,
      floors: project.floors,
      bedrooms: project.bedrooms,
      bathrooms: project.bathrooms,
      style: project.style || undefined,
      budget: project.budget,
      selectedInteriorStyle: project.selectedInteriorStyle || undefined,
    });
  }, [
    project?.landWidth,
    project?.landLength,
    project?.floors,
    project?.bedrooms,
    project?.bathrooms,
    project?.style,
    project?.budget,
    checkFormReactions,
  ]);

  useEffect(() => {
    if (!project) return;
    resetIdleTimer(currentStep);

    const handleActivity = () => resetIdleTimer(currentStep);
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [currentStep, project?.id, resetIdleTimer]);

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

  const statuses = (project.stepStatuses || {}) as Record<string, string>;

  const getStepStatus = (step: number) => statuses[step] || "pending";

  const handleProcess = (step: number) => processStep.mutate({ projectId, step });
  const handleApprove = (step: number) => approveStep.mutate({ projectId, step });
  const handleRedo = (step: number) => redoStep.mutate({ projectId, step });
  const handleSubmit = (step: number, data: Record<string, unknown>) => submitStep.mutate({ projectId, step, data });

  const stepProps = (step: number) => ({
    project: project as Project,
    stepStatus: getStepStatus(step),
    onProcess: () => handleProcess(step),
    onApprove: () => handleApprove(step),
    onRedo: () => handleRedo(step),
    onGoBack: step > 1 ? () => handleRedo(step - 1) : () => navigate("/"),
    backLabel: step === 1 ? "Dashboard" : "Quay lại",
    isProcessing: processStep.isPending,
    isApproving: approveStep.isPending,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="project-wizard">
      <header className="h-13 border-b border-border/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-3 sm:px-5 flex items-center gap-3 sticky top-0 z-50">
        <Link href="/">
          <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-muted-foreground hover:text-foreground" data-testid="button-back">
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
        </Link>

        <div className="flex items-center gap-2 mr-1">
          <img src={logoImg} alt="BMT" className="w-6 h-6 object-contain opacity-80" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-foreground text-sm truncate" data-testid="text-project-title">{project.title}</h1>
          {project.clientName && <p className="text-xs text-muted-foreground truncate">👤 {project.clientName}</p>}
        </div>

        {project.status === "completed" && (
          <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap" data-testid="badge-completed">
            ✓ Hoàn thành
          </span>
        )}
      </header>

      <div className="px-3 sm:px-5 py-2.5 bg-white/60 dark:bg-slate-900/60 border-b border-border/30 overflow-x-auto">
        <div className="flex items-center min-w-max sm:min-w-0 gap-0.5 max-w-3xl mx-auto">
          {STEPS.map((step, i) => {
            const status = getStepStatus(step.num);
            const isCurrent = step.num === currentStep;
            const isCompleted = status === "approved";
            const isAccessible = step.num <= currentStep;
            const StepIcon = step.icon;

            return (
              <div key={step.num} className="flex items-center">
                <div className={cn(
                  "flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                  isCurrent && "bg-primary text-white shadow-md shadow-primary/25",
                  isCompleted && !isCurrent && "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
                  !isCurrent && !isCompleted && isAccessible && "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
                  !isAccessible && "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                )} data-testid={`stepper-step-${step.num}`}>
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <StepIcon className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "h-0.5 w-3 sm:w-4 shrink-0 mx-0.5 rounded-full",
                    isCompleted ? "bg-green-400 dark:bg-green-600" : isCurrent ? "bg-primary/40" : "bg-slate-200 dark:bg-slate-700"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {currentStep === 1 && <Step1DataCollection {...stepProps(1)} onSubmit={(data) => handleSubmit(1, data)} isNewProject={false} />}
          {currentStep === 2 && <Step2Analysis {...stepProps(2)} />}
          {currentStep === 3 && <Step3CAD {...stepProps(3)} />}
          {currentStep === 4 && <Step4Model3D {...stepProps(4)} onSubmit={(data) => handleSubmit(4, data)} />}
          {currentStep === 5 && <Step5Interior {...stepProps(5)} />}
          {currentStep === 6 && <Step6Render {...stepProps(6)} />}
          {currentStep === 7 && <Step7PDF {...stepProps(7)} />}

          {project.status === "completed" && currentStep >= 7 && getStepStatus(7) === "approved" && (
            <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-xl font-bold text-green-700 dark:text-green-300 mb-2">Dự án hoàn thành!</h2>
              <p className="text-green-600 dark:text-green-400">Tất cả 7 bước đã được duyệt. Hồ sơ PDF đã sẵn sàng tải xuống.</p>
            </div>
          )}
        </div>
      </div>

      <FloatingChatCopilot
        messages={messages}
        isLoading={chatLoading}
        onSendMessage={(msg) => sendMessage(msg, currentStep)}
        unreadCount={unreadCount}
        onOpen={markRead}
        onClose={markClosed}
      />
    </div>
  );
}
