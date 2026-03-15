import { useState } from "react";
import { cn } from "@/lib/utils";
import { StepWrapper } from "./StepWrapper";
import { Step1Sub1BasicInfo } from "./Step1Sub1BasicInfo";
import { Step1Sub2Architecture } from "./Step1Sub2Architecture";
import { Step1Sub3Requirements } from "./Step1Sub3Requirements";
import { Step1Sub4Confirmation } from "./Step1Sub4Confirmation";
import { useCreateProject } from "@/hooks/use-projects";
import type { Project } from "@shared/schema";

const SUB_STEPS = [
  { num: 1, label: "Thông tin" },
  { num: 2, label: "Kiến trúc" },
  { num: 3, label: "Yêu cầu" },
  { num: 4, label: "Xác nhận" },
];

const REQUIREMENTS_MAP: Record<string, string> = {
  fengShui: "Phong thủy", altarRoom: "Phòng thờ", garage: "Gara xe",
  office: "Phòng làm việc", garden: "Sân vườn", pool: "Hồ bơi",
  rooftop: "Sân thượng", basement: "Tầng hầm",
};

interface LocalSelections {
  selectedArchitecture?: { name: string; image: string };
  selectedInteriorStyle?: string;
  siteRequirements?: Record<string, boolean>;
  budgetSheetUrl?: string;
  uploadedFiles?: unknown[];
}

interface Props {
  project: Project | null;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  onGoBack?: () => void;
  backLabel?: string;
  onSubmit: (data: Record<string, unknown>) => void;
  isProcessing: boolean;
  isApproving: boolean;
  isNewProject?: boolean;
  onProjectCreated?: (project: Project) => void;
}

export function Step1DataCollection({
  project,
  stepStatus,
  onProcess,
  onApprove,
  onRedo,
  onGoBack,
  backLabel,
  onSubmit,
  isProcessing,
  isApproving,
  isNewProject = false,
  onProjectCreated,
}: Props) {
  const createMutation = useCreateProject();
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [localSelections, setLocalSelections] = useState<LocalSelections>({});

  const activeProject = project || createdProject;

  const mergedProject = activeProject ? {
    ...activeProject,
    ...(localSelections.selectedArchitecture && { selectedArchitecture: localSelections.selectedArchitecture }),
    ...(localSelections.selectedInteriorStyle && { selectedInteriorStyle: localSelections.selectedInteriorStyle, style: localSelections.selectedInteriorStyle }),
    ...(localSelections.siteRequirements && { siteRequirements: localSelections.siteRequirements }),
    ...(localSelections.uploadedFiles && { uploadedFiles: localSelections.uploadedFiles }),
    ...(localSelections.budgetSheetUrl !== undefined && { budgetSheetUrl: localSelections.budgetSheetUrl }),
  } as Project : null;

  const initialSubStep = isNewProject ? 1 : 3;
  const [subStep, setSubStep] = useState(initialSubStep);
  const minSubStep = isNewProject ? 1 : 3;

  const handleBasicInfoSubmit = (data: Record<string, unknown>) => {
    if (activeProject) {
      setSubStep(2);
      return;
    }
    createMutation.mutate(data, {
      onSuccess: (newProject: Project) => {
        setCreatedProject(newProject);
        onProjectCreated?.(newProject);
        setSubStep(2);
      },
    });
  };

  const handleArchitectureNext = (architecture: { name: string; image: string }, interiorStyle: string) => {
    if (!activeProject) return;
    setLocalSelections(prev => ({
      ...prev,
      selectedArchitecture: architecture,
      selectedInteriorStyle: interiorStyle,
    }));
    onSubmit({
      selectedArchitecture: architecture,
      selectedInteriorStyle: interiorStyle,
      style: interiorStyle,
    });
    setSubStep(3);
  };

  const handleRequirementsNext = (data: { siteRequirements: Record<string, boolean>; budgetSheetUrl: string; uploadedFiles: unknown[] }) => {
    setLocalSelections(prev => ({
      ...prev,
      siteRequirements: data.siteRequirements,
      budgetSheetUrl: data.budgetSheetUrl,
      uploadedFiles: data.uploadedFiles,
    }));
    onSubmit(data);
    setSubStep(4);
  };

  const handleProcess = () => {
    onProcess();
  };

  if (stepStatus === "processing" || stepStatus === "completed" || stepStatus === "approved") {
    const displayProject = mergedProject || activeProject;
    const reqs = ((displayProject?.siteRequirements as Record<string, boolean>) || {});
    const activeReqs = Object.entries(reqs).filter(([, v]) => v);
    const arch = displayProject?.selectedArchitecture as { name: string; image: string } | null;
    const uploadedFiles = ((displayProject?.uploadedFiles as Array<{ originalName?: string; name?: string; type: string; url: string }>) || []);

    return (
      <StepWrapper
        title="Bước 1: Thu thập dữ liệu"
        description="Kiểm tra thông tin khu đất và bổ sung yêu cầu thiết kế."
        stepStatus={stepStatus}
        onProcess={handleProcess}
        onApprove={onApprove}
        onRedo={onRedo}
        onGoBack={onGoBack}
        backLabel={backLabel}
        isProcessing={isProcessing}
        isApproving={isApproving}
        forceShowForm={false}
        resultContent={displayProject ? (
          <div className="space-y-3">
            <h3 className="font-semibold text-green-700 dark:text-green-400">Dữ liệu đã thu thập</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <span className="text-muted-foreground">Kích thước</span>
                <p className="font-semibold">{displayProject.landWidth}m x {displayProject.landLength}m</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <span className="text-muted-foreground">Diện tích</span>
                <p className="font-semibold">{displayProject.landWidth * displayProject.landLength} m²</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <span className="text-muted-foreground">Số tầng</span>
                <p className="font-semibold">{displayProject.floors} tầng</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <span className="text-muted-foreground">Phòng ngủ / WC</span>
                <p className="font-semibold">{displayProject.bedrooms} PN / {displayProject.bathrooms} WC</p>
              </div>
            </div>
            {arch && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <span className="text-muted-foreground text-sm">Kiến trúc & Nội thất</span>
                <p className="font-semibold mt-1">{arch.name}</p>
                {displayProject.selectedInteriorStyle && (
                  <p className="text-sm text-primary">{displayProject.selectedInteriorStyle}</p>
                )}
              </div>
            )}
            {activeReqs.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <span className="text-muted-foreground text-sm">Yêu cầu đặc biệt</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {activeReqs.map(([k]) => (
                    <span key={k} className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-lg">
                      {REQUIREMENTS_MAP[k] || k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {uploadedFiles.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <span className="text-muted-foreground text-sm">File đã upload ({uploadedFiles.length})</span>
              </div>
            )}
          </div>
        ) : undefined}
      >
        <div className="text-sm text-muted-foreground">Đang xử lý...</div>
      </StepWrapper>
    );
  }

  if (subStep === 1 && isNewProject) {
    return (
      <SubStepLayout current={subStep} min={minSubStep}>
        <Step1Sub1BasicInfo
          onSubmit={handleBasicInfoSubmit}
          isPending={createMutation.isPending}
          existingProject={activeProject}
        />
      </SubStepLayout>
    );
  }

  if (!activeProject) return null;

  if (subStep === 2) {
    return (
      <SubStepLayout current={subStep} min={minSubStep}>
        <Step1Sub2Architecture
          project={activeProject}
          onNext={handleArchitectureNext}
          onBack={() => setSubStep(Math.max(minSubStep, 1))}
          isPending={false}
        />
      </SubStepLayout>
    );
  }

  if (subStep === 3) {
    return (
      <SubStepLayout current={subStep} min={minSubStep}>
        <Step1Sub3Requirements
          project={mergedProject || activeProject}
          onNext={handleRequirementsNext}
          onBack={() => setSubStep(Math.max(minSubStep, 2))}
          onSubmitField={onSubmit}
        />
      </SubStepLayout>
    );
  }

  if (subStep === 4) {
    return (
      <SubStepLayout current={subStep} min={minSubStep}>
        <Step1Sub4Confirmation
          project={mergedProject || activeProject}
          onProcess={handleProcess}
          onBack={() => setSubStep(3)}
          isProcessing={isProcessing}
        />
      </SubStepLayout>
    );
  }

  return null;
}

function SubStepLayout({ current, min, children }: { current: number; min: number; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <SubStepNav current={current} min={min} />
      </div>
      <div className="glass-card rounded-2xl p-6">
        {children}
      </div>
    </div>
  );
}

function SubStepNav({ current, min }: { current: number; min: number }) {
  return (
    <div className="flex items-center justify-center gap-1" data-testid="substep-nav">
      {SUB_STEPS.filter(s => s.num >= min).map((step, i, arr) => {
        const isActive = step.num === current;
        const isCompleted = step.num < current;
        return (
          <div key={step.num} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                isActive && "bg-primary text-white shadow-md shadow-primary/25",
                isCompleted && "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
                !isActive && !isCompleted && "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              )}
              data-testid={`substep-${step.num}`}
            >
              <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
                {isCompleted ? "✓" : `1.${step.num}`}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < arr.length - 1 && (
              <div className={cn(
                "h-0.5 w-4 mx-0.5 rounded-full",
                isCompleted ? "bg-green-400" : isActive ? "bg-primary/40" : "bg-slate-200 dark:bg-slate-700"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
