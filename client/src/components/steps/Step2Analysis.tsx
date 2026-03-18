import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { Sparkles, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  project: Project;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  onGoBack?: () => void;
  backLabel?: string;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step2Analysis({ project, stepStatus, onProcess, onApprove, onRedo, onGoBack, backLabel, isProcessing, isApproving }: Props) {
  const analysis = project.analysisResult as Record<string, string> | null;
  const layout = project.layoutResult as { floors?: Array<{ floor: number; rooms: Array<{ name: string; w: number; h: number }> }> } | null;
  
  const handleBackToStep1 = async () => {
    const res = await fetch(`/api/projects/${project.id}/step/1/redo`, { method: "POST" });
    if (res.ok) window.location.reload();
  };

  return (
    <StepWrapper
      title="Bước 2: Phân tích hiện trạng & Tạo Layout"
      description="AI phân tích khu đất và tự động tạo bố trí layout phòng."
      stepStatus={stepStatus}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      onGoBack={onGoBack}
      backLabel={backLabel}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        <div className="space-y-5">
          {analysis && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Kết quả phân tích AI
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <span className="text-xs text-muted-foreground">Kích thước</span>
                  <p className="text-sm font-semibold">{analysis.dimensions}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <span className="text-xs text-muted-foreground">Diện tích</span>
                  <p className="text-sm font-semibold">{analysis.area}</p>
                </div>
              </div>
              {analysis.aiAnalysis && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto" data-testid="text-ai-analysis">
                  {analysis.aiAnalysis}
                </div>
              )}
            </div>
          )}

          {layout && layout.floors && (
            <div>
              <h3 className="font-semibold mb-3">Layout phòng (AI đề xuất)</h3>
              {layout.floors.map(floor => (
                <div key={floor.floor} className="mb-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Tầng {floor.floor}</p>
                  <div className="bg-slate-100 rounded-xl p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {floor.rooms.map((room, i) => (
                        <div
                          key={i}
                          className="bg-white border-2 border-primary/20 rounded-lg p-3 text-center hover:border-primary/50 transition-colors"
                          data-testid={`layout-room-${floor.floor}-${i}`}
                        >
                          <p className="text-xs font-semibold text-primary">{room.name}</p>
                          <p className="text-xs text-muted-foreground">{room.w}m x {room.h}m</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!analysis && !layout && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-300 text-center">Chưa có dữ liệu từ Bước 1. Hãy quay lại Bước 1 để hoàn thành.</p>
              <div className="text-center">
                <Button 
                  onClick={handleBackToStep1}
                  variant="outline"
                  className="border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Quay lại Bước 1
                </Button>
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-700">
            AI sẽ phân tích: hướng nhà, ánh sáng tự nhiên, thông gió, phong thủy sơ bộ. Sau đó tự động tạo bố trí layout phòng cho {project.floors} tầng.
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-2 text-sm">
          <p><strong>Kích thước:</strong> {project.landWidth}m x {project.landLength}m ({project.landWidth * project.landLength} m²)</p>
          <p><strong>Tầng:</strong> {project.floors} | <strong>Phòng ngủ:</strong> {project.bedrooms}</p>
          <p><strong>Phong cách:</strong> {project.style}</p>
        </div>
      </div>
    </StepWrapper>
  );
}
