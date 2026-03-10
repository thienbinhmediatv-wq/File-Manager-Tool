import { useState } from "react";
import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Image } from "lucide-react";

const RENDER_ANGLES = [
  { id: "facade", label: "Mặt tiền ban ngày" },
  { id: "facadeNight", label: "Mặt tiền ban đêm" },
  { id: "living", label: "Phòng khách" },
  { id: "bedroom", label: "Phòng ngủ Master" },
  { id: "kitchen", label: "Bếp & Phòng ăn" },
  { id: "garden", label: "Sân vườn" },
  { id: "panorama", label: "Panorama 360°" },
];

interface Props {
  project: Project;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step6Render({ project, stepStatus, onProcess, onApprove, onRedo, isProcessing, isApproving }: Props) {
  const [selectedAngles, setSelectedAngles] = useState<Record<string, boolean>>({ facade: true, living: true, bedroom: true });
  const result = project.renderResult as {
    renders?: Array<{ name: string; url: string; angle: string }>;
  } | null;

  return (
    <StepWrapper
      title="Bước 6: Render phối cảnh"
      description="AI tạo hình ảnh render phối cảnh chất lượng cao."
      stepStatus={stepStatus}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        result && result.renders ? (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" /> Render phối cảnh (AI Generated)
            </h3>
            <div className="space-y-4">
              {result.renders.map((r, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border/50" data-testid={`render-image-${i}`}>
                  <img src={r.url} alt={r.name} className="w-full object-contain" />
                  <div className="p-3 bg-slate-50">
                    <p className="font-semibold text-sm">{r.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-purple-700">
            AI sẽ tạo hình ảnh render phối cảnh cho mỗi góc nhìn. Mỗi hình mất khoảng 15-30 giây.
          </p>
        </div>
        <div>
          <Label className="font-semibold mb-3 block">Góc render</Label>
          <div className="grid grid-cols-2 gap-3">
            {RENDER_ANGLES.map(a => (
              <label key={a.id} className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:bg-slate-50 cursor-pointer" data-testid={`checkbox-angle-${a.id}`}>
                <Checkbox
                  checked={selectedAngles[a.id] || false}
                  onCheckedChange={() => setSelectedAngles(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                />
                <span className="text-sm font-medium">{a.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </StepWrapper>
  );
}
