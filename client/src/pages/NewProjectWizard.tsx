import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Camera, Ruler, Layout, Box, Sofa, Image, FileText } from "lucide-react";
import { Step1DataCollection } from "@/components/steps/Step1DataCollection";
import { useProject, useProcessStep, useSubmitStep } from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoImg from "@assets/logo_nobg.png";
import type { Project } from "@shared/schema";

const STEPS = [
  { num: 1, label: "Thu thập", shortLabel: "1", icon: Camera },
  { num: 2, label: "Phân tích", shortLabel: "2", icon: Ruler },
  { num: 3, label: "CAD", shortLabel: "3", icon: Layout },
  { num: 4, label: "3D", shortLabel: "4", icon: Box },
  { num: 5, label: "Nội thất", shortLabel: "5", icon: Sofa },
  { num: 6, label: "Render", shortLabel: "6", icon: Image },
  { num: 7, label: "PDF", shortLabel: "7", icon: FileText },
];

export default function NewProjectWizard() {
  const [, navigate] = useLocation();
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null);
  const { data: project } = useProject(createdProjectId || 0);
  const processStep = useProcessStep();
  const submitStep = useSubmitStep();

  const handleProjectCreated = (newProject: Project) => {
    setCreatedProjectId(newProject.id);
  };

  const handleSubmit = (step: number, data: Record<string, unknown>) => {
    if (!createdProjectId) return;
    submitStep.mutate({ projectId: createdProjectId, step, data });
  };

  const handleProcess = (step: number) => {
    if (!createdProjectId) return;
    processStep.mutate({ projectId: createdProjectId, step }, {
      onSuccess: () => {
        navigate(`/projects/${createdProjectId}`);
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="new-project-wizard">
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
          <h1 className="font-bold text-foreground text-sm truncate" data-testid="text-new-project-title">
            {project?.title || "Tạo dự án mới"}
          </h1>
          <p className="text-xs text-muted-foreground truncate">Bước 1: Thu thập dữ liệu</p>
        </div>
      </header>

      <div className="px-3 sm:px-5 py-2.5 bg-white/60 dark:bg-slate-900/60 border-b border-border/30 overflow-x-auto">
        <div className="flex items-center min-w-max sm:min-w-0 gap-0.5 max-w-3xl mx-auto">
          {STEPS.map((step, i) => {
            const isCurrent = step.num === 1;
            const StepIcon = step.icon;
            return (
              <div key={step.num} className="flex items-center">
                <div className={cn(
                  "flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                  isCurrent && "bg-primary text-white shadow-md shadow-primary/25",
                  !isCurrent && "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                )} data-testid={`stepper-step-${step.num}`}>
                  <StepIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="h-0.5 w-3 sm:w-4 shrink-0 mx-0.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Step1DataCollection
          project={project || null}
          stepStatus="pending"
          onProcess={() => handleProcess(1)}
          onApprove={() => {}}
          onRedo={() => {}}
          onGoBack={() => navigate("/")}
          backLabel="Dashboard"
          onSubmit={(data) => handleSubmit(1, data)}
          isProcessing={processStep.isPending}
          isApproving={false}
          isNewProject={true}
          onProjectCreated={handleProjectCreated}
        />
      </div>
    </div>
  );
}
