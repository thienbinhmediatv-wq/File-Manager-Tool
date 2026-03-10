import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronLeft, Building2, Ruler, Maximize, Play, Download, Sparkles, AlertCircle, FileText } from "lucide-react";
import { useProject, useStartPipeline } from "@/hooks/use-projects";
import { AppLayout } from "@/components/layout/AppLayout";
import { PipelineStepper } from "@/components/projects/PipelineStepper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id);
  
  const { data: project, isLoading, error } = useProject(projectId);
  const startPipeline = useStartPipeline();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  if (error || !project) {
    return (
      <AppLayout>
        <Alert variant="destructive" className="max-w-2xl mx-auto mt-10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Project not found or could not be loaded.</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  const isProcessing = project.status === 'processing' || startPipeline.isPending;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/projects">
            <Button variant="ghost" size="icon" className="rounded-full bg-white/50 hover:bg-white shadow-sm border border-slate-200">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{project.title}</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              ID: PRJ-{project.id.toString().padStart(4, '0')} • Created {new Date(project.createdAt || '').toLocaleDateString()}
            </p>
          </div>
          
          {project.status === 'pending' && (
            <Button 
              onClick={() => startPipeline.mutate(project.id)}
              disabled={isProcessing}
              className="bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all rounded-xl px-6 h-12 text-base"
            >
              {isProcessing ? (
                <span className="flex items-center animate-pulse">Starting Engine...</span>
              ) : (
                <span className="flex items-center"><Play className="w-4 h-4 mr-2 fill-current" /> Start AI Generation</span>
              )}
            </Button>
          )}

          {project.status === 'completed' && (
            <Button className="rounded-xl px-6 h-12 bg-slate-900 text-white hover:bg-slate-800 shadow-lg transition-all">
              <Download className="w-4 h-4 mr-2" /> Download Portfolio PDF
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Col: Specs */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-primary" />
                Specifications
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl flex justify-between items-center border border-slate-100">
                  <span className="text-slate-500 font-medium">Style</span>
                  <span className="font-bold text-foreground">{project.style}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-sm block mb-1">Dimensions</span>
                    <div className="font-bold flex items-center text-foreground">
                      <Ruler className="w-4 h-4 mr-1.5 text-primary" />
                      {project.landWidth} x {project.landLength}m
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-sm block mb-1">Total Area</span>
                    <div className="font-bold flex items-center text-foreground">
                      <Maximize className="w-4 h-4 mr-1.5 text-primary" />
                      {project.landWidth * project.landLength} m²
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-sm block mb-1">Floors</span>
                    <div className="font-bold text-foreground text-lg">{project.floors}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-sm block mb-1">Bedrooms</span>
                    <div className="font-bold text-foreground text-lg">{project.bedrooms}</div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl flex justify-between items-center border border-slate-100">
                  <span className="text-slate-500 font-medium">Est. Budget</span>
                  <span className="font-bold text-green-600">{project.budget.toLocaleString()} Mil VND</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Pipeline & Results */}
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card rounded-2xl p-8">
              <h3 className="text-lg font-bold mb-2">Generation Pipeline</h3>
              <p className="text-muted-foreground text-sm mb-6">Real-time status of AI design generation</p>
              
              <PipelineStepper status={isProcessing ? 'processing' : project.status} />
            </div>

            {/* Results Section - Shows when processing or completed */}
            {(project.status === 'completed' || isProcessing) && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-32 bg-primary/5 blur-3xl rounded-full" />
                
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Generated Concept
                </h3>

                {project.status === 'completed' ? (
                  <div className="space-y-6 relative z-10">
                    {/* Render Image - Using Unsplash placeholder since we don't have real dynamic uploads yet */}
                    <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner group">
                      {/* landing page hero modern architectural house render */}
                      <img 
                        src={project.conceptImageUrl || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop"} 
                        alt="Concept Render"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-semibold text-sm text-slate-500 mb-2">Floorplan Layout (JSON Data)</h4>
                        <pre className="text-xs font-mono text-slate-700 bg-slate-100 p-2 rounded-lg overflow-x-auto">
                          {project.layoutData ? JSON.stringify(project.layoutData, null, 2) : "{\n  \"status\": \"Generated\",\n  \"rooms\": 5,\n  \"sqm\": " + (project.landWidth * project.landLength) + "\n}"}
                        </pre>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center">
                        <FileText className="w-12 h-12 text-slate-300 mb-3" />
                        <h4 className="font-bold text-foreground">Full Portfolio PDF</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4">Contains all CADs, Renders & BOQ</p>
                        <Button variant="outline" size="sm" className="rounded-lg w-full">View PDF</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video w-full rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50/50">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <p className="mt-6 font-medium text-slate-600 animate-pulse">Architectural AI is designing...</p>
                    <p className="text-xs text-slate-400 mt-2">This typically takes 2-3 minutes</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
