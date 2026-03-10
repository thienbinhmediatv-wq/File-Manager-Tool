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
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step5Interior({ project, stepStatus, onProcess, onApprove, onRedo, isProcessing, isApproving }: Props) {
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, boolean>>({});
  const [interiorStyle, setInteriorStyle] = useState(project.style);
  const [lighting, setLighting] = useState("Ấm áp (Warm)");
  const result = project.interiorResult as {
    materials?: Array<{ name: string; area: string; cost: string }>;
    furniture?: Array<{ room: string; items: string[] }>;
    estimatedCost?: string;
    note?: string;
  } | null;

  return (
    <StepWrapper
      title="Bước 5: Thiết kế nội thất"
      description="Chọn vật liệu, đồ nội thất, ánh sáng cho từng phòng."
      stepStatus={stepStatus}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        result ? (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Thiết kế nội thất
            </h3>

            {result.materials && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Bảng vật liệu</p>
                <div className="space-y-2">
                  {result.materials.map((m, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 rounded-lg p-3 text-sm">
                      <div>
                        <p className="font-semibold">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.area}</p>
                      </div>
                      <span className="text-primary font-medium">{m.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.furniture && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Danh sách nội thất</p>
                {result.furniture.map((f, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 mb-2">
                    <p className="font-semibold text-sm mb-1">{f.room}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {f.items.map((item, j) => (
                        <span key={j} className="bg-white border border-border/50 text-xs px-2 py-1 rounded-lg">{item}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.estimatedCost && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-sm"><strong>Chi phí ước tính:</strong> <span className="text-green-700 font-semibold">{result.estimatedCost}</span></p>
              </div>
            )}
            {result.note && <p className="text-xs text-muted-foreground italic">{result.note}</p>}
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
              <label key={m.id} className="flex items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-slate-50 cursor-pointer" data-testid={`checkbox-material-${m.id}`}>
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
