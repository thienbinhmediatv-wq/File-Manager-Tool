import { useState, useEffect, useCallback } from "react";
import { StepWrapper, ImageGallery } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Image, Video, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProgressPolling } from "@/hooks/use-progress-polling";
import { ProgressCircle } from "@/components/ProgressCircle";

const RENDER_ANGLES = [
  { id: "facade", label: "Mặt tiền ban ngày" },
  { id: "facadeNight", label: "Mặt tiền ban đêm" },
  { id: "living", label: "Phòng khách" },
  { id: "bedroom", label: "Phòng ngủ Master" },
  { id: "kitchen", label: "Bếp & Phòng ăn" },
  { id: "garden", label: "Sân vườn" },
  { id: "panorama", label: "Panorama 360°" },
];

const VIDEO_MODELS = [
  { id: "minimax-image-to-video", label: "MiniMax" },
  { id: "wan-2.1", label: "Wan 2.1" },
  { id: "kling-1.6-pro", label: "Kling 1.6 Pro" },
];

interface Props {
  project: Project;
  stepStatus: string;
  stepNumber?: number;
  projectId?: number;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  onGoBack?: () => void;
  backLabel?: string;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step6Render({ project, stepStatus, stepNumber, projectId, onProcess, onApprove, onRedo, onGoBack, backLabel, isProcessing, isApproving }: Props) {
  const [selectedAngles, setSelectedAngles] = useState<Record<string, boolean>>({ facade: true, living: true, bedroom: true });
  const [videoJobs, setVideoJobs] = useState<Record<string, { jobId: string; status: string; output?: string }>>({});
  const [generatingVideo, setGeneratingVideo] = useState<string | null>(null);
  const [selectedVideoModel, setSelectedVideoModel] = useState("minimax-image-to-video");
  const { toast } = useToast();
  const isProcessingState = stepStatus === "processing";
  const progressData = useProgressPolling(projectId, stepNumber, isProcessingState);

  const result = project.renderResult as {
    renders?: Array<{ name: string; url: string; angle: string }>;
  } | null;

  const handleGenerateVideo = useCallback(async (renderName: string, imageUrl: string) => {
    setGeneratingVideo(renderName);
    try {
      const resp = await apiRequest("POST", "/api/generate-video", {
        projectId: project.id,
        imageUrl,
        prompt: `Smooth cinematic camera movement around this ${project.style} architecture, slowly panning to reveal details, professional real estate video, 4K quality`,
        model: selectedVideoModel,
      });
      const data = await resp.json();
      setVideoJobs(prev => ({ ...prev, [renderName]: { jobId: data.jobId, status: "pending" } }));
      toast({ title: "Video đang tạo", description: `Video "${renderName}" đang được xử lý. Có thể mất 1-2 phút.` });
    } catch (err) {
      toast({ title: "Lỗi", description: "Không thể tạo video", variant: "destructive" });
    } finally {
      setGeneratingVideo(null);
    }
  }, [project.id, project.style, selectedVideoModel, toast]);

  useEffect(() => {
    const pendingJobs = Object.entries(videoJobs).filter(([_, j]) => j.status === "pending" || j.status === "processing");
    if (pendingJobs.length === 0) return;

    const interval = setInterval(async () => {
      for (const [name, job] of pendingJobs) {
        try {
          const resp = await fetch(`/api/generate-video/${job.jobId}`);
          const data = await resp.json();
          if (data.status === "success" || data.status === "error") {
            setVideoJobs(prev => ({
              ...prev,
              [name]: { ...prev[name], status: data.status, output: data.output },
            }));
            if (data.status === "success") {
              toast({ title: "Video xong!", description: `Video "${name}" đã sẵn sàng.` });
            }
          }
        } catch { /* retry next interval */ }
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [videoJobs, toast]);

  return (
    <StepWrapper
      title="Bước 6: Render phối cảnh"
      description="AI tạo hình ảnh render phối cảnh và video flythrough."
      stepStatus={stepStatus}
      stepNumber={stepNumber}
      projectId={projectId}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      onGoBack={onGoBack}
      backLabel={backLabel}
      isProcessing={isProcessing}
      isApproving={isApproving}
      loadingContent={isProcessingState ? <ProgressCircle progress={progressData.progress} message={progressData.message} /> : undefined}
      resultContent={
        result && result.renders ? (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" /> Render phối cảnh (AI Generated)
            </h3>
            <ImageGallery images={result.renders.map(r => ({ url: r.url, label: r.name }))} />

            <div className="space-y-2" data-testid="render-video-controls">
              {result.renders.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-muted/30">
                  <p className="text-sm font-medium truncate flex-1">{r.name}</p>
                  {videoJobs[r.name]?.status === "success" && videoJobs[r.name]?.output ? (
                    <a href={videoJobs[r.name].output} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="rounded-lg gap-1.5 text-xs shrink-0" data-testid={`button-view-video-${i}`}>
                        <Video className="w-3.5 h-3.5 text-green-600" /> Xem Video
                      </Button>
                    </a>
                  ) : videoJobs[r.name]?.status === "pending" || videoJobs[r.name]?.status === "processing" ? (
                    <Button size="sm" variant="outline" className="rounded-lg gap-1.5 text-xs shrink-0" disabled>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tạo...
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg gap-1.5 text-xs shrink-0"
                      onClick={() => handleGenerateVideo(r.name, r.url)}
                      disabled={generatingVideo === r.name}
                      data-testid={`button-generate-video-${i}`}
                    >
                      {generatingVideo === r.name ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gửi...</>
                      ) : (
                        <><Video className="w-3.5 h-3.5" /> Tạo Video</>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {Object.values(videoJobs).some(j => j.status === "success" && j.output) && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h4 className="font-semibold text-sm text-green-700 flex items-center gap-2 mb-2">
                  <Video className="w-4 h-4" /> Video đã tạo
                </h4>
                <div className="space-y-2">
                  {Object.entries(videoJobs)
                    .filter(([_, j]) => j.status === "success" && j.output)
                    .map(([name, j]) => (
                      <div key={name} className="flex items-center justify-between bg-white rounded-lg p-2">
                        <span className="text-sm">{name}</span>
                        <a href={j.output} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="rounded-lg text-xs h-7 bg-green-600 hover:bg-green-700">
                            Xem Video
                          </Button>
                        </a>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-purple-700">
            AI sẽ tạo hình ảnh render phối cảnh. Sau đó bạn có thể tạo video flythrough từ mỗi hình.
          </p>
        </div>
        <div>
          <Label className="font-semibold mb-3 block">Góc render</Label>
          <div className="grid grid-cols-2 gap-3">
            {RENDER_ANGLES.map(a => (
              <label key={a.id} className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:bg-slate-50 cursor-pointer" data-testid={`checkbox-angle-${a.id}`}>
                <Checkbox
                  checked={selectedAngles[a.id] || false}
                  onCheckedChange={() => setSelectedAngles(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                />
                <span className="text-sm font-medium">{a.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <Label className="font-semibold mb-2 block">Model tạo Video</Label>
          <div className="flex gap-2">
            {VIDEO_MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedVideoModel(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedVideoModel === m.id ? "border-primary bg-primary/5 text-primary" : "border-border/50 hover:border-primary/30"}`}
                data-testid={`video-model-${m.id}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </StepWrapper>
  );
}
