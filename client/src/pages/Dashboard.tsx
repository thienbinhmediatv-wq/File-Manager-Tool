import { useState } from "react";
import { Link } from "wouter";
import { Plus, Building2, Ruler, Calendar, ArrowRight, Trash2 } from "lucide-react";
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
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Dự án</h1>
          <p className="text-muted-foreground mt-1 text-lg">Quản lý các dự án thiết kế kiến trúc AI.</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200 rounded-xl px-6 h-12 text-base font-semibold"
          data-testid="button-create-project"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tạo dự án mới
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 glass-card rounded-2xl animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="glass-card rounded-3xl p-16 text-center flex flex-col items-center justify-center border-dashed border-2 border-slate-200">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Building2 className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Chưa có dự án</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Tạo dự án thiết kế kiến trúc đầu tiên để AI tự động tạo layout, 3D, render và hồ sơ PDF.
          </p>
          <Button onClick={() => setIsCreateOpen(true)} size="lg" className="rounded-xl" data-testid="button-create-first">
            Tạo dự án đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects?.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id} className="block h-full" data-testid={`card-project-${project.id}`}>
              <div className="glass-card rounded-2xl p-6 h-full flex flex-col group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1" data-testid={`text-project-title-${project.id}`}>
                    {project.title}
                  </h3>
                  <Badge variant="outline" className={cn(
                    "capitalize font-semibold border rounded-lg px-2 py-0.5 text-xs shrink-0",
                    project.status === "completed" && "bg-green-50 text-green-700 border-green-200",
                    project.status === "active" && "bg-blue-50 text-blue-700 border-blue-200",
                    project.status === "pending" && "bg-slate-100 text-slate-600 border-slate-200"
                  )} data-testid={`badge-status-${project.id}`}>
                    {project.status === "completed" ? "Hoàn thành" : project.status === "active" ? "Đang làm" : "Mới"}
                  </Badge>
                </div>

                {project.clientName && (
                  <p className="text-sm text-muted-foreground mb-3" data-testid={`text-client-${project.id}`}>
                    KH: {project.clientName}
                  </p>
                )}

                <div className="bg-primary/5 rounded-lg px-3 py-2 mb-4">
                  <p className="text-sm font-semibold text-primary" data-testid={`text-step-${project.id}`}>
                    Bước {project.currentStep}/7 — {STEP_NAMES[project.currentStep] || ""}
                  </p>
                  <div className="w-full bg-primary/10 rounded-full h-1.5 mt-2">
                    <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${(project.currentStep / 7) * 100}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-600 mb-4">
                  <div className="flex items-center">
                    <Ruler className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    {project.landWidth}m x {project.landLength}m
                  </div>
                  <div className="flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    {project.floors} tầng, {project.bedrooms} PN
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    {format(new Date(project.createdAt || new Date()), "dd/MM/yyyy")}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      className="p-1.5 text-slate-400 hover:text-destructive hover:bg-red-50 rounded-lg transition-colors"
                      data-testid={`button-delete-${project.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="p-1.5 bg-slate-50 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </AppLayout>
  );
}
