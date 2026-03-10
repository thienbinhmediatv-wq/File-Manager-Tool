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
    cadDrawings?: Array<{ name: string; type: string; imageUrl?: string }>;
    cadDescription?: string;
    dimensions?: { totalArea: number; wallThickness: number; floorHeight: number };
  } | null;

  return (
    <StepWrapper
      title="Bước 3: Xuất bản vẽ CAD/BIM"
      description="AI tạo bản vẽ mặt bằng 2D (tường, cửa, cầu thang, kích thước)."
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
              <FileText className="w-4 h-4 text-primary" /> Bản vẽ CAD (AI)
            </h3>

            {cadResult.cadDrawings?.map((d, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-border/50" data-testid={`cad-drawing-${i}`}>
                {d.imageUrl && (
                  <img src={d.imageUrl} alt={d.name} className="w-full object-contain bg-white" />
                )}
                <div className="p-3 bg-slate-50">
                  <p className="font-semibold text-sm">{d.name}</p>
                </div>
              </div>
            ))}

            {cadResult.cadDescription && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                {cadResult.cadDescription}
              </div>
            )}

            {cadResult.dimensions && (
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
            )}
          </div>
        ) : null
      }
    >
      <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
        <p>AI sẽ tạo bản vẽ mặt bằng bao gồm:</p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Mặt bằng tổng thể (tường, cửa, cầu thang)</li>
          <li>Mô tả kỹ thuật chi tiết</li>
          <li>Kích thước tất cả các phòng</li>
        </ul>
      </div>
    </StepWrapper>
  );
}
