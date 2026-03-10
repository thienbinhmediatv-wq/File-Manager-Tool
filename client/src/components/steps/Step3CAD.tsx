import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { FileText, Ruler } from "lucide-react";

interface Props {
  project: Project;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step3CAD({ project, stepStatus, onProcess, onApprove, onRedo, isProcessing, isApproving }: Props) {
  const cadResult = project.cadResult as {
    cadDrawings: Array<{ name: string; type: string; floor?: number }>;
    dimensions: { totalArea: number; wallThickness: number; floorHeight: number };
    note: string;
  } | null;

  return (
    <StepWrapper
      title="Bước 3: Xuất bản vẽ CAD/BIM"
      description="Từ layout đã duyệt, tạo bản vẽ 2D chi tiết (tường, cửa, cầu thang, kích thước)."
      stepStatus={stepStatus}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        cadResult ? (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Bản vẽ CAD
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {cadResult.cadDrawings.map((d, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 border border-border/50 hover:border-primary/30 transition-colors" data-testid={`cad-drawing-${i}`}>
                  <div className="w-full h-32 bg-slate-200 rounded-lg mb-3 flex items-center justify-center">
                    <svg viewBox="0 0 200 150" className="w-full h-full p-4">
                      <rect x="10" y="10" width="180" height="130" fill="none" stroke="#6366f1" strokeWidth="2" />
                      <rect x="20" y="20" width="70" height="50" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="4" />
                      <rect x="100" y="20" width="80" height="50" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="4" />
                      <rect x="20" y="80" width="160" height="50" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="4" />
                      <text x="55" y="48" fontSize="8" fill="#6366f1" textAnchor="middle">{d.type === "floorplan" ? `Tầng ${d.floor}` : d.name}</text>
                    </svg>
                  </div>
                  <p className="font-semibold text-sm">{d.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{d.type}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-primary" />
                <div>
                  <span className="text-xs text-muted-foreground">Tổng DT</span>
                  <p className="font-semibold">{cadResult.dimensions.totalArea} m²</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">Tường</span>
                <p className="font-semibold">{cadResult.dimensions.wallThickness}m</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">Cao tầng</span>
                <p className="font-semibold">{cadResult.dimensions.floorHeight}m</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic">{cadResult.note}</p>
          </div>
        ) : null
      }
    >
      <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
        <p>Bản vẽ CAD sẽ bao gồm:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Mặt bằng các tầng (tường, cửa, cầu thang)</li>
          <li>Mặt cắt A-A, B-B</li>
          <li>Mặt đứng chính, mặt đứng hông</li>
          <li>Kích thước chi tiết tất cả các phòng</li>
        </ul>
      </div>
    </StepWrapper>
  );
}
