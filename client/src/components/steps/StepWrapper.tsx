import { useState, ReactNode } from "react";
import { Check, RotateCcw, Loader2, Sparkles, Download, Maximize2, X, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const REDO_LIMITED_STEPS = [4, 5, 6];
const REDO_LIMIT = 1;

interface StepWrapperProps {
  title: string;
  description: string;
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
  children: ReactNode;
  resultContent?: ReactNode;
  forceShowForm?: boolean;
  loadingContent?: ReactNode;
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
  title, description, stepStatus, stepNumber, projectId, onProcess, onApprove, onRedo, onGoBack, backLabel,
  isProcessing, isApproving, children, resultContent, forceShowForm, loadingContent,
}: StepWrapperProps) {
  const showResult = stepStatus === "completed" || stepStatus === "approved" || (stepStatus === "processing" && !!resultContent);
  const showForm = forceShowForm || stepStatus === "pending" || stepStatus === "submitted" || stepStatus === "error";
  const isCompleted = stepStatus === "completed";
  const isApproved = stepStatus === "approved";
  const isProcessingState = stepStatus === "processing";

  const redoLimitKey = stepNumber && projectId ? `redo_${projectId}_step${stepNumber}` : null;
  const isRedoLimited = stepNumber !== undefined && REDO_LIMITED_STEPS.includes(stepNumber);
  const getRedoCount = () => {
    if (!redoLimitKey) return 0;
    return parseInt(localStorage.getItem(redoLimitKey) || "0", 10);
  };
  const redoCount = getRedoCount();
  const redoExhausted = isRedoLimited && redoCount >= REDO_LIMIT;

  const handleRedoWithLimit = () => {
    if (redoExhausted) return;
    if (redoLimitKey) {
      localStorage.setItem(redoLimitKey, String(redoCount + 1));
    }
    onRedo();
  };

  return (
    <div className="space-y-5 pb-20" data-testid="step-wrapper">
      <div>
        <h2 className="text-xl font-bold text-foreground" data-testid="text-step-title">{title}</h2>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>

      {showForm && (
        <div className="space-y-4">
          {children}
        </div>
      )}

      {isProcessingState && !resultContent && (
        loadingContent || (
          <div className="rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center" style={{ borderColor: "rgba(232,131,12,0.3)", background: "rgba(232,131,12,0.05)" }} data-testid="step-loading">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#e8830c" }} />
            <p className="mt-4 font-semibold text-sm" style={{ color: "#e8830c" }}>AI đang xử lý...</p>
          </div>
        )
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
          {isCompleted && (
            <p className="text-xs text-muted-foreground text-center" data-testid="text-step-hint">
              Không hài lòng? Chat với AI để chỉnh sửa, nhấn Duyệt khi OK.
            </p>
          )}
        </div>
      )}

      {!isProcessingState && (
        <div
          className="sticky bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-border/50 px-3 py-3 -mx-3 sm:-mx-6 sm:px-6 flex items-center justify-between gap-2"
          data-testid="step-bottom-bar"
        >
          {showForm && !isCompleted && !isApproved && (
            <>
              {onGoBack ? (
                <Button
                  onClick={onGoBack}
                  variant="outline"
                  className="rounded-xl px-3 sm:px-5 min-h-[44px] text-sm"
                  data-testid="button-go-back"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">{backLabel || "Quay lại"}</span><span className="sm:hidden">Lại</span>
                </Button>
              ) : (
                <div />
              )}
              <Button
                onClick={onProcess}
                disabled={isProcessing}
                className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-xl px-3 sm:px-5 min-h-[44px] text-sm"
                data-testid="button-ai-process"
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> AI đang xử lý...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-1.5" /> Tiếp tục</>
                )}
              </Button>
            </>
          )}

          {isCompleted && (
            <>
              <div className="flex flex-col items-start">
                <Button
                  onClick={handleRedoWithLimit}
                  disabled={redoExhausted}
                  variant="outline"
                  className="rounded-xl px-3 sm:px-5 min-h-[44px] text-sm dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-redo"
                  title={redoExhausted ? `Đã dùng hết ${REDO_LIMIT} lần làm lại cho bước này` : undefined}
                >
                  {redoExhausted ? (
                    <><Lock className="w-4 h-4 mr-1.5 text-red-500" /> <span className="hidden sm:inline">Làm lại (đã dùng)</span><span className="sm:hidden">Đã dùng</span></>
                  ) : (
                    <><RotateCcw className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">Làm lại {isRedoLimited ? `(còn ${REDO_LIMIT - redoCount}/${REDO_LIMIT})` : ""}</span><span className="sm:hidden">Lại</span></>
                  )}
                </Button>
                {isRedoLimited && (
                  <span className="text-[10px] text-muted-foreground mt-1 pl-1 hidden sm:block">
                    {redoExhausted ? "Không thể làm lại thêm" : `Giới hạn ${REDO_LIMIT} lần/bước`}
                  </span>
                )}
              </div>
              <Button
                onClick={onApprove}
                disabled={isApproving}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-3 sm:px-5 min-h-[44px] text-sm shadow-lg shadow-green-600/20"
                data-testid="button-approve"
              >
                {isApproving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                <span className="hidden sm:inline">Duyệt & Tiếp tục</span><span className="sm:hidden">Duyệt</span>
              </Button>
            </>
          )}

          {isApproved && onGoBack && (
            <Button
              onClick={onGoBack}
              variant="outline"
              className="rounded-xl px-5 min-h-[44px] text-sm"
              data-testid="button-go-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1.5" /> {backLabel || "Quay lại"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
