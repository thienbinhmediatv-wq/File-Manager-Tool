import { useState } from "react";
import { Link } from "wouter";
import { Plus, Building2, Ruler, Calendar, ArrowRight, Trash2, Camera, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { useProjects, useDeleteProject } from "@/hooks/use-projects";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STEP_NAMES: Record<number, string> = {
  1: "Thu thập dữ liệu",
  2: "Phân tích & Layout",
  3: "Xuất CAD",
  4: "3D & Mặt tiền",
  5: "Nội thất",
  6: "Render",
  7: "Xuất PDF",
};

const STEP_ICONS: Record<number, string> = {
  1: "📸", 2: "📐", 3: "📋", 4: "🎲", 5: "🛋️", 6: "🖼️", 7: "📄",
};

function getProjectThumbnail(project: any): string | null {
  const render = project.renderResult as { renders?: { url: string }[] } | null;
  if (render?.renders?.[0]?.url) return render.renders[0].url;
  const model = project.model3dResult as { facadeImages?: string[] } | null;
  if (model?.facadeImages?.[0]) return model.facadeImages[0];
  const cad = project.cadResult as { cadDrawings?: { imageUrl?: string }[] } | null;
  if (cad?.cadDrawings?.[0]?.imageUrl) return cad.cadDrawings[0].imageUrl;
  return null;
}

const statusConfig = {
  completed: { label: "Hoàn thành", className: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700" },
  active: { label: "Đang làm", className: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700" },
  pending: { label: "Mới", className: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600" },
};

export default function Dashboard() {
  const { data: projects, isLoading } = useProjects();
  const deleteMutation = useDeleteProject();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if (confirm("Bạn có chắc muốn xoá dự án này?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-page-title">Dự án</h1>
          <p className="text-muted-foreground mt-1">Quản lý các dự án thiết kế kiến trúc AI.</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 rounded-xl px-6 h-11 font-semibold"
          data-testid="button-create-project"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tạo dự án mới
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 glass-card rounded-2xl animate-pulse bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="glass-card rounded-3xl p-16 text-center flex flex-col items-center justify-center border-dashed border-2 border-slate-200 dark:border-slate-700">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Building2 className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Chưa có dự án</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Tạo dự án thiết kế kiến trúc đầu tiên để AI tự động tạo layout, 3D, render và hồ sơ PDF.
          </p>
          <Button onClick={() => setIsCreateOpen(true)} size="lg" className="rounded-xl bg-primary" data-testid="button-create-first">
            Tạo dự án đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects?.map((project) => {
            const thumbnail = getProjectThumbnail(project);
            const status = (project.status || "pending") as keyof typeof statusConfig;
            const sc = statusConfig[status] || statusConfig.pending;
            const progress = Math.round(((project.currentStep - 1) / 6) * 100);

            return (
              <Link href={`/projects/${project.id}`} key={project.id} className="block h-full" data-testid={`card-project-${project.id}`}>
                <div className="glass-card rounded-2xl overflow-hidden h-full flex flex-col group">
                  <div className="relative h-40 bg-gradient-to-br from-primary/10 to-orange-100/50 dark:from-primary/20 dark:to-orange-900/20 overflow-hidden">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={project.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <span className="text-5xl">{STEP_ICONS[project.currentStep] || "🏠"}</span>
                          <p className="text-xs text-muted-foreground mt-2">Bước {project.currentStep}/7</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <Badge variant="outline" className={cn("text-xs font-semibold border rounded-lg px-2 py-0.5 backdrop-blur-sm bg-white/80 dark:bg-black/40", sc.className)} data-testid={`badge-status-${project.id}`}>
                        {sc.label}
                      </Badge>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-1.5">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 flex-1" data-testid={`text-project-title-${project.id}`}>
                        {project.title}
                      </h3>
                    </div>

                    {project.clientName && (
                      <p className="text-xs text-muted-foreground mb-3" data-testid={`text-client-${project.id}`}>
                        👤 {project.clientName}
                      </p>
                    )}

                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-primary">
                          {STEP_ICONS[project.currentStep]} Bước {project.currentStep}/7 — {STEP_NAMES[project.currentStep] || ""}
                        </span>
                        <span className="text-xs text-muted-foreground">{progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-primary to-orange-400 transition-all duration-500"
                          style={{ width: `${Math.max(progress, 5)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-400 mb-3">
                      <div className="flex items-center gap-1">
                        <Ruler className="w-3 h-3 text-primary shrink-0" />
                        <span>{project.landWidth}×{project.landLength}m</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-primary shrink-0" />
                        <span>{project.floors}T {project.bedrooms}PN</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-primary shrink-0" />
                        <span>{project.budget}M</span>
                      </div>
                    </div>

                    <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center text-xs text-muted-foreground gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(project.createdAt || new Date()), "dd/MM/yyyy")}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          className="p-1.5 text-slate-400 hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          data-testid={`button-delete-${project.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="p-1.5 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </AppLayout>
  );
}
