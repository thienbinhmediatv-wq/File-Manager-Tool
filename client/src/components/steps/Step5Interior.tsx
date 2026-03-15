import { useState } from "react";
import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette } from "lucide-react";

const MATERIALS = [
  { id: "wood", label: "Gỗ tự nhiên" },
  { id: "stone", label: "Đá tự nhiên" },
  { id: "glass", label: "Kính" },
  { id: "metal", label: "Kim loại" },
  { id: "concrete", label: "Bê tông lộ" },
  { id: "ceramic", label: "Gạch men" },
];

const INTERIOR_STYLES = ["Modern", "Minimalist", "Scandinavian", "Industrial", "Wabi Sabi", "Luxury", "Indochine"];
const LIGHTING_STYLES = ["Ấm áp (Warm)", "Trung tính (Neutral)", "Mát (Cool)", "Kết hợp"];

interface Props {
  project: Project;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  onGoBack?: () => void;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step5Interior({ project, stepStatus, onProcess, onApprove, onRedo, onGoBack, isProcessing, isApproving }: Props) {
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, boolean>>({});
  const [interiorStyle, setInteriorStyle] = useState(project.style);
  const [lighting, setLighting] = useState("Ấm áp (Warm)");
  const result = project.interiorResult as {
    interiorDescription?: string;
    interiorImages?: Array<{ name: string; url: string }>;
    estimatedCost?: string;
  } | null;

  return (
    <StepWrapper
      title="Bước 5: Thiết kế nội thất"
      description="AI thiết kế nội thất chi tiết với vật liệu, đồ nội thất, ánh sáng."
      stepStatus={stepStatus}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      onGoBack={onGoBack}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        result ? (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Nội thất (AI Generated)
            </h3>

            {result.interiorImages && (
              <div className="grid grid-cols-2 gap-3">
                {result.interiorImages.map((img, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-border/50">
                    <img src={img.url} alt={img.name} className="w-full object-contain" />
                    <div className="p-2 bg-slate-50 dark:bg-slate-800 text-center">
                      <p className="text-sm font-semibold">{img.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.interiorDescription && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">
                {result.interiorDescription}
              </div>
            )}

            {result.estimatedCost && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-sm"><strong>Chi phí nội thất ước tính:</strong> <span className="text-green-700 font-semibold">{result.estimatedCost}</span></p>
              </div>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        <div>
          <Label className="font-semibold mb-2 block">Phong cách nội thất</Label>
          <Select value={interiorStyle} onValueChange={setInteriorStyle}>
            <SelectTrigger className="h-11 rounded-xl" data-testid="select-interior-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERIOR_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="font-semibold mb-3 block">Vật liệu ưa thích</Label>
          <div className="grid grid-cols-3 gap-3">
            {MATERIALS.map(m => (
              <label key={m.id} className="flex items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer" data-testid={`checkbox-material-${m.id}`}>
                <Checkbox
                  checked={selectedMaterials[m.id] || false}
                  onCheckedChange={() => setSelectedMaterials(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                />
                <span className="text-sm font-medium">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="font-semibold mb-2 block">Ánh sáng</Label>
          <Select value={lighting} onValueChange={setLighting}>
            <SelectTrigger className="h-11 rounded-xl" data-testid="select-lighting">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIGHTING_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </StepWrapper>
  );
}
