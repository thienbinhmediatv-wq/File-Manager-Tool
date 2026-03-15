import { useState, ReactNode } from "react";
import { Check, RotateCcw, Loader2, Sparkles, Download, Maximize2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepWrapperProps {
  title: string;
  description: string;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  onGoBack?: () => void;
  isProcessing: boolean;
  isApproving: boolean;
  children: ReactNode;
  resultContent?: ReactNode;
}

interface ImageGalleryImage {
  url: string;
  label?: string;
}

interface ImageGalleryProps {
  images: ImageGalleryImage[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const handleDownload = (url: string, label?: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = label ? `${label.replace(/\s+/g, "_")}.png` : "image.png";
    a.target = "_blank";
    a.click();
  };

  return (
    <>
      <div className={`grid gap-3 ${images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {images.map((img, i) => (
          <div key={i} className="relative group rounded-xl overflow-hidden border border-border/50 bg-muted/30" data-testid={`gallery-image-${i}`}>
            <img
              src={img.url}
              alt={img.label || `Hình ${i + 1}`}
              className="w-full object-contain max-h-72 cursor-pointer"
              onClick={() => setLightboxIndex(i)}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setLightboxIndex(i)}
                className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-colors"
                title="Xem full"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDownload(img.url, img.label)}
                className="p-1.5 bg-black/60 text-white rounded-lg hover:bg-black/80 transition-colors"
                title="Tải xuống"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
            {img.label && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                <p className="text-white text-xs font-medium">{img.label}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="w-5 h-5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => Math.max(0, (prev ?? 0) - 1)); }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => Math.min(images.length - 1, (prev ?? 0) + 1)); }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="max-w-5xl w-full px-16" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[lightboxIndex].url}
              alt={images[lightboxIndex].label || "Hình ảnh"}
              className="w-full object-contain max-h-[85vh] rounded-xl"
            />
            {images[lightboxIndex].label && (
              <p className="text-white/80 text-sm text-center mt-3">{images[lightboxIndex].label}</p>
            )}
            <div className="flex justify-center mt-4 gap-3">
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => handleDownload(images[lightboxIndex].url, images[lightboxIndex].label)}
              >
                <Download className="w-4 h-4 mr-2" /> Tải xuống
              </Button>
            </div>
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-4 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${i === lightboxIndex ? "bg-white" : "bg-white/40"}`}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function StepWrapper({
  title, description, stepStatus, onProcess, onApprove, onRedo, onGoBack,
  isProcessing, isApproving, children, resultContent,
}: StepWrapperProps) {
  const showResult = stepStatus === "completed" || stepStatus === "approved" || (stepStatus === "processing" && !!resultContent);
  const showForm = stepStatus === "pending" || stepStatus === "submitted" || stepStatus === "error";

  return (
    <div className="space-y-5" data-testid="step-wrapper">
      <div>
        <h2 className="text-xl font-bold text-foreground" data-testid="text-step-title">{title}</h2>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>

      {showForm && (
        <div className="space-y-4">
          {children}
          <div className="flex gap-3 pt-2">
            {onGoBack && (
              <Button
                onClick={onGoBack}
                variant="outline"
                className="rounded-xl px-6"
                data-testid="button-go-back"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Quay lại
              </Button>
            )}
            <Button
              onClick={onProcess}
              disabled={isProcessing}
              className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-xl px-6"
              data-testid="button-ai-process"
            >
              {isProcessing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI đang xử lý...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> AI Xử lý</>
              )}
            </Button>
          </div>
        </div>
      )}

      {stepStatus === "processing" && !resultContent && (
        <div className="rounded-2xl border-2 border-dashed border-primary/30 p-10 flex flex-col items-center justify-center bg-primary/5 dark:bg-primary/10">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="mt-4 font-semibold text-primary animate-pulse">AI đang xử lý...</p>
          <p className="text-xs text-muted-foreground mt-1">Tạo hình ảnh có thể mất 30-60 giây. Vui lòng chờ.</p>
        </div>
      )}

      {stepStatus === "error" && (
        <div className="rounded-2xl border-2 border-red-200 dark:border-red-800 p-4 bg-red-50 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">Có lỗi xảy ra. Bấm "AI Xử lý" để thử lại.</p>
        </div>
      )}

      {showResult && resultContent && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-white/80 dark:bg-slate-800/80 p-5" data-testid="step-result">
            {resultContent}
          </div>

          {stepStatus !== "approved" && (
            <div className="flex gap-3">
              <Button
                onClick={onApprove}
                disabled={isApproving}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-6 shadow-lg shadow-green-600/20"
                data-testid="button-approve"
              >
                {isApproving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Duyệt & Tiếp tục
              </Button>
              <Button
                onClick={onRedo}
                variant="outline"
                className="rounded-xl px-6 dark:border-slate-600"
                data-testid="button-redo"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Làm lại
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
