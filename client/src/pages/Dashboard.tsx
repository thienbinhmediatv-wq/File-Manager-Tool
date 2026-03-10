import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Plus, Building2, Ruler, Calendar, ArrowRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useProjects, useDeleteProject } from "@/hooks/use-projects";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: projects, isLoading } = useProjects();
  const deleteMutation = useDeleteProject();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault(); // Prevent navigating to project details
    if (confirm("Are you sure you want to delete this project?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your automated architectural portfolios.</p>
        </div>
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200 rounded-xl px-6 h-12 text-base font-semibold"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Project
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
          <h2 className="text-2xl font-bold mb-2">No projects yet</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Create your first architectural project to automatically generate floorplans, 3D models, and PDF portfolios.
          </p>
          <Button onClick={() => setIsCreateOpen(true)} size="lg" className="rounded-xl">
            Create First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects?.map((project, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={project.id}
            >
              <Link href={`/projects/${project.id}`} className="block h-full">
                <div className="glass-card rounded-2xl p-6 h-full flex flex-col group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                    <Badge variant="outline" className={cn(
                      "capitalize font-semibold border-2 rounded-lg px-3",
                      project.status === 'completed' && "bg-green-50 text-green-700 border-green-200",
                      project.status === 'processing' && "bg-blue-50 text-blue-700 border-blue-200 animate-pulse",
                      project.status === 'pending' && "bg-slate-100 text-slate-700 border-slate-200",
                      project.status === 'failed' && "bg-red-50 text-red-700 border-red-200"
                    )}>
                      {project.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 mb-6 mt-2">
                    <div className="flex items-center text-sm text-slate-600">
                      <Ruler className="w-4 h-4 mr-2 text-primary" />
                      {project.landWidth}m x {project.landLength}m
                    </div>
                    <div className="flex items-center text-sm text-slate-600">
                      <Building2 className="w-4 h-4 mr-2 text-primary" />
                      {project.floors} Floors, {project.bedrooms} Beds
                    </div>
                    <div className="flex items-center text-sm text-slate-600 col-span-2">
                      <span className="font-semibold text-foreground mr-2">Style:</span> {project.style}
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      {format(new Date(project.createdAt || new Date()), 'MMM d, yyyy')}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => handleDelete(e, project.id)}
                        className="p-2 text-slate-400 hover:text-destructive hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-2 bg-slate-50 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </AppLayout>
  );
}
