import { useState } from "react";
import { Upload, FileText, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";

const REQUIREMENTS = [
  { id: "fengShui", label: "Phong thủy" },
  { id: "altarRoom", label: "Phòng thờ" },
  { id: "garage", label: "Gara xe" },
  { id: "office", label: "Phòng làm việc" },
  { id: "garden", label: "Sân vườn" },
  { id: "pool", label: "Hồ bơi" },
  { id: "rooftop", label: "Sân thượng" },
  { id: "basement", label: "Tầng hầm" },
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

export function Step1DataCollection({ project, stepStatus, onProcess, onApprove, onRedo, onSubmit, isProcessing, isApproving }: Props) {
  const [requirements, setRequirements] = useState<Record<string, boolean>>(
    (project.siteRequirements as Record<string, boolean>) || {}
  );
  const [budgetUrl, setBudgetUrl] = useState(project.budgetSheetUrl || "");

  const handleToggle = (id: string) => {
    const updated = { ...requirements, [id]: !requirements[id] };
    setRequirements(updated);
    onSubmit({ siteRequirements: updated });
  };

  const handleProcess = () => {
    onSubmit({ siteRequirements: requirements, budgetSheetUrl: budgetUrl });
    onProcess();
  };

  return (
    <StepWrapper
      title="Bước 1: Thu thập dữ liệu"
      description="Kiểm tra thông tin khu đất và bổ sung yêu cầu thiết kế."
      stepStatus={stepStatus}
      onProcess={handleProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        <div className="space-y-3">
          <h3 className="font-semibold text-green-700">Dữ liệu đã thu thập</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-muted-foreground">Kích thước</span>
              <p className="font-semibold">{project.landWidth}m x {project.landLength}m</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-muted-foreground">Diện tích</span>
              <p className="font-semibold">{project.landWidth * project.landLength} m²</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-muted-foreground">Số tầng</span>
              <p className="font-semibold">{project.floors} tầng</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-muted-foreground">Phòng ngủ</span>
              <p className="font-semibold">{project.bedrooms} phòng</p>
            </div>
          </div>
          {Object.entries(requirements).filter(([,v]) => v).length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-muted-foreground text-sm">Yêu cầu đặc biệt</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(requirements).filter(([,v]) => v).map(([k]) => (
                  <span key={k} className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-lg">
                    {REQUIREMENTS.find(r => r.id === k)?.label || k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700">
            Thông tin cơ bản đã có từ khi tạo dự án: <strong>{project.landWidth}m x {project.landLength}m</strong>,{" "}
            <strong>{project.floors} tầng</strong>, <strong>{project.bedrooms} PN</strong>, phong cách <strong>{project.style}</strong>.
          </p>
        </div>

        <div>
          <Label className="font-semibold mb-3 block">Yêu cầu đặc biệt</Label>
          <div className="grid grid-cols-2 gap-3">
            {REQUIREMENTS.map(req => (
              <label key={req.id} className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:bg-slate-50 cursor-pointer transition-colors" data-testid={`checkbox-req-${req.id}`}>
                <Checkbox
                  checked={requirements[req.id] || false}
                  onCheckedChange={() => handleToggle(req.id)}
                />
                <span className="text-sm font-medium">{req.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label className="font-semibold mb-2 block">Upload file (hình ảnh, sổ đỏ, bản vẽ...)</Label>
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer" data-testid="upload-area">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Kéo thả file hoặc click để chọn</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF, DWG (tối đa 20MB)</p>
          </div>
        </div>

        <div>
          <Label className="font-semibold mb-2 block">
            <FileText className="w-4 h-4 inline mr-1" /> File dự toán (PDF)
          </Label>
          <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors cursor-pointer">
            <p className="text-sm text-muted-foreground">Upload file dự toán PDF</p>
          </div>
        </div>

        <div>
          <Label className="font-semibold mb-2 block">
            <LinkIcon className="w-4 h-4 inline mr-1" /> Hoặc nhập link Google Sheet dự toán
          </Label>
          <Input
            value={budgetUrl}
            onChange={(e) => setBudgetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="h-11 rounded-xl"
            data-testid="input-budget-url"
          />
        </div>
      </div>
    </StepWrapper>
  );
}
