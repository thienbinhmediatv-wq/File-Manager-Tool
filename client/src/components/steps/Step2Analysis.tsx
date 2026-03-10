import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { Compass, Sun, Wind, Sparkles } from "lucide-react";

interface Props {
  project: Project;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step2Analysis({ project, stepStatus, onProcess, onApprove, onRedo, isProcessing, isApproving }: Props) {
  const analysis = project.analysisResult as Record<string, string> | null;
  const layout = project.layoutResult as { floors: Array<{ floor: number; rooms: Array<{ name: string; x: number; y: number; w: number; h: number }> }> } | null;

  return (
    <StepWrapper
      title="Bước 2: Phân tích hiện trạng & Tạo Layout"
      description="AI phân tích khu đất và tự động tạo bố trí layout phòng."
      stepStatus={stepStatus}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        <div className="space-y-5">
          {analysis && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Kết quả phân tích
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2">
                  <Compass className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-muted-foreground">Hướng nhà</span>
                    <p className="text-sm font-semibold">{analysis.orientation}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2">
                  <Sun className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-muted-foreground">Ánh sáng</span>
                    <p className="text-sm font-semibold">{analysis.sunlight}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2">
                  <Wind className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-muted-foreground">Thông gió</span>
                    <p className="text-sm font-semibold">{analysis.wind}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-lg shrink-0">☯️</span>
                  <div>
                    <span className="text-xs text-muted-foreground">Phong thủy</span>
                    <p className="text-sm font-semibold">{analysis.fengShui}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {layout && layout.floors && (
            <div>
              <h3 className="font-semibold mb-3">Layout phòng</h3>
              {layout.floors.map(floor => (
                <div key={floor.floor} className="mb-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Tầng {floor.floor}</p>
                  <div className="relative bg-slate-100 rounded-xl p-4" style={{ minHeight: 200 }}>
                    <div className="grid grid-cols-3 gap-2">
                      {floor.rooms.map((room, i) => (
                        <div
                          key={i}
                          className="bg-white border-2 border-primary/20 rounded-lg p-2 text-center hover:border-primary/50 transition-colors"
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
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-700">
            AI sẽ phân tích: hướng nhà, ánh sáng tự nhiên, thông gió, phong thủy sơ bộ. Sau đó tự động tạo bố trí layout phòng cho {project.floors} tầng.
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <p><strong>Kích thước:</strong> {project.landWidth}m x {project.landLength}m ({project.landWidth * project.landLength} m²)</p>
          <p><strong>Tầng:</strong> {project.floors} | <strong>Phòng ngủ:</strong> {project.bedrooms}</p>
          <p><strong>Phong cách:</strong> {project.style}</p>
        </div>
      </div>
    </StepWrapper>
  );
}
