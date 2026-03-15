import { useState } from "react";
import { StepWrapper, ImageGallery } from "./StepWrapper";
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
  onGoBack?: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step4Model3D({ project, stepStatus, onProcess, onApprove, onRedo, onGoBack, onSubmit, isProcessing, isApproving }: Props) {
  const [facadeStyle, setFacadeStyle] = useState(project.facadeStyle || project.style);
  const [colorScheme, setColorScheme] = useState("white-gray");
  const result = project.model3dResult as { facadeImages?: string[]; designDescription?: string; facadeStyle?: string } | null;

  const handleProcess = () => {
    onSubmit({ facadeStyle });
    onProcess();
  };

  return (
    <StepWrapper
      title="Bước 4: Mô hình 3D & Mặt tiền"
      description="AI tạo hình ảnh mặt tiền dựa trên phong cách bạn chọn."
      stepStatus={stepStatus}
      onProcess={handleProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      onGoBack={onGoBack}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        result ? (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Box className="w-4 h-4 text-primary" /> Mặt tiền (AI Generated)
            </h3>
            {result.facadeImages && result.facadeImages.length > 0 && (
              <ImageGallery images={result.facadeImages.map((url, i) => ({ url, label: `Mặt tiền ${i + 1}` }))} />
            )}
            {result.designDescription && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                {result.designDescription}
              </div>
            )}
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
