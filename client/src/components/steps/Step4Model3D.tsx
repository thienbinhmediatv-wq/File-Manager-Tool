import { useState } from "react";
import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Box } from "lucide-react";

const FACADE_STYLES = ["Modern", "Minimalist", "Neoclassic", "Industrial", "Tropical", "Wabi Sabi", "Indochine"];
const COLORS = [
  { value: "white-gray", label: "Trắng - Xám", color: "#e5e7eb" },
  { value: "warm-wood", label: "Nâu gỗ ấm", color: "#92400e" },
  { value: "dark-modern", label: "Đen hiện đại", color: "#1f2937" },
  { value: "earth-tone", label: "Tông đất", color: "#78716c" },
  { value: "blue-glass", label: "Xanh kính", color: "#0ea5e9" },
];

interface Props {
  project: Project;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step4Model3D({ project, stepStatus, onProcess, onApprove, onRedo, onSubmit, isProcessing, isApproving }: Props) {
  const [facadeStyle, setFacadeStyle] = useState(project.facadeStyle || project.style);
  const [colorScheme, setColorScheme] = useState("white-gray");
  const result = project.model3dResult as { facadeImages?: string[]; note?: string } | null;

  const handleProcess = () => {
    onSubmit({ facadeStyle });
    onProcess();
  };

  return (
    <StepWrapper
      title="Bước 4: Mô hình 3D & Mặt tiền"
      description="Chọn phong cách mặt tiền và AI sẽ dựng mô hình 3D."
      stepStatus={stepStatus}
      onProcess={handleProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        result ? (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Box className="w-4 h-4 text-primary" /> Mô hình 3D & Mặt tiền
            </h3>
            {result.facadeImages && (
              <div className="grid grid-cols-2 gap-3">
                {result.facadeImages.map((url, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-border/50" data-testid={`facade-image-${i}`}>
                    <img src={url} alt={`Mặt tiền ${i + 1}`} className="w-full h-48 object-cover hover:scale-105 transition-transform duration-500" />
                  </div>
                ))}
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <p><strong>Phong cách:</strong> {facadeStyle}</p>
            </div>
            {result.note && <p className="text-xs text-muted-foreground italic">{result.note}</p>}
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        <div>
          <Label className="font-semibold mb-2 block">Phong cách mặt tiền</Label>
          <Select value={facadeStyle} onValueChange={setFacadeStyle}>
            <SelectTrigger className="h-11 rounded-xl" data-testid="select-facade-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FACADE_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="font-semibold mb-2 block">Tông màu chủ đạo</Label>
          <div className="grid grid-cols-5 gap-3">
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setColorScheme(c.value)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${colorScheme === c.value ? "border-primary shadow-md" : "border-border/50 hover:border-primary/30"}`}
                data-testid={`color-${c.value}`}
              >
                <div className="w-8 h-8 rounded-full mx-auto mb-1.5" style={{ backgroundColor: c.color }} />
                <p className="text-xs font-medium">{c.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </StepWrapper>
  );
}
