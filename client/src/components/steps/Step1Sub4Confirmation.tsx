import { Button } from "@/components/ui/button";
import { Loader2, Building2, Ruler, BedDouble, Bath, Home, Palette, TreePine } from "lucide-react";
import type { Project } from "@shared/schema";

const REQUIREMENTS_MAP: Record<string, string> = {
  fengShui: "Phong thủy",
  altarRoom: "Phòng thờ",
  garage: "Gara xe",
  office: "Phòng làm việc",
  garden: "Sân vườn",
  pool: "Hồ bơi",
  rooftop: "Sân thượng",
  basement: "Tầng hầm",
};

interface Props {
  project: Project;
  onProcess: () => void;
  onBack: () => void;
  isProcessing: boolean;
}

export function Step1Sub4Confirmation({ project, onProcess, onBack, isProcessing }: Props) {
  const reqs = (project.siteRequirements as Record<string, boolean>) || {};
  const activeReqs = Object.entries(reqs).filter(([, v]) => v);
  const arch = project.selectedArchitecture as { name: string; image: string } | null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1" data-testid="text-sub4-title">Xác nhận thông tin</h3>
        <p className="text-sm text-muted-foreground">Kiểm tra lại toàn bộ thông tin trước khi AI xử lý.</p>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Home className="w-4 h-4 text-primary" />
            Thông tin dự án
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-border/30">
              <span className="text-muted-foreground text-xs">Tên dự án</span>
              <p className="font-semibold" data-testid="text-confirm-title">{project.title}</p>
            </div>
            {project.clientName && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-border/30">
                <span className="text-muted-foreground text-xs">Khách hàng</span>
                <p className="font-semibold" data-testid="text-confirm-client">{project.clientName}</p>
              </div>
            )}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-border/30">
              <span className="text-muted-foreground text-xs">Loại dự án</span>
              <p className="font-semibold" data-testid="text-confirm-type">{project.projectType || "Xây mới"}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-border/30">
              <span className="text-muted-foreground text-xs">Ngân sách</span>
              <p className="font-semibold" data-testid="text-confirm-budget">{project.budget} triệu</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Ruler className="w-4 h-4 text-primary" />
            Cấu hình
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-border/30 text-center">
              <Ruler className="w-4 h-4 mx-auto text-primary mb-1" />
              <span className="text-muted-foreground text-xs block">Kích thước</span>
              <p className="font-semibold">{project.landWidth}m × {project.landLength}m</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-border/30 text-center">
              <Building2 className="w-4 h-4 mx-auto text-primary mb-1" />
              <span className="text-muted-foreground text-xs block">Số tầng</span>
              <p className="font-semibold">{project.floors} tầng</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-border/30 text-center">
              <BedDouble className="w-4 h-4 mx-auto text-primary mb-1" />
              <span className="text-muted-foreground text-xs block">Phòng ngủ</span>
              <p className="font-semibold">{project.bedrooms} phòng</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-border/30 text-center">
              <Bath className="w-4 h-4 mx-auto text-primary mb-1" />
              <span className="text-muted-foreground text-xs block">Phòng WC</span>
              <p className="font-semibold">{project.bathrooms} phòng</p>
            </div>
          </div>
        </div>

        {arch && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 space-y-4">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              Kiến trúc & Nội thất
            </h4>
            <div className="flex gap-4 items-start">
              <img
                src={arch.image}
                alt={arch.name}
                className="w-24 h-20 rounded-xl object-cover border border-border/30"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div>
                <p className="font-semibold text-sm" data-testid="text-confirm-arch">{arch.name}</p>
                {project.selectedInteriorStyle && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Nội thất: <span className="text-primary font-medium" data-testid="text-confirm-interior">{project.selectedInteriorStyle}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeReqs.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 space-y-3">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <TreePine className="w-4 h-4 text-primary" />
              Yêu cầu đặc biệt
            </h4>
            <div className="flex flex-wrap gap-2">
              {activeReqs.map(([k]) => (
                <span key={k} className="bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-lg">
                  {REQUIREMENTS_MAP[k] || k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 flex justify-between">
        <Button type="button" variant="outline" className="rounded-xl px-6" onClick={onBack} data-testid="button-back-sub4">
          ← Quay lại
        </Button>
        <Button
          type="button"
          disabled={isProcessing}
          onClick={onProcess}
          className="rounded-xl px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25"
          data-testid="button-process-ai"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang xử lý...</>
          ) : "🚀 Xử lý AI"}
        </Button>
      </div>
    </div>
  );
}
