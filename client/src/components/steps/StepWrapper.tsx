import { ReactNode } from "react";
import { Check, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepWrapperProps {
  title: string;
  description: string;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  isProcessing: boolean;
  isApproving: boolean;
  children: ReactNode;
  resultContent?: ReactNode;
}

export function StepWrapper({
  title, description, stepStatus, onProcess, onApprove, onRedo,
  isProcessing, isApproving, children, resultContent,
}: StepWrapperProps) {
  const showResult = stepStatus === "completed" || stepStatus === "approved" || (stepStatus === "processing" && !!resultContent);
  const showForm = stepStatus === "pending" || stepStatus === "submitted" || stepStatus === "error";

  return (
    <div className="space-y-6" data-testid="step-wrapper">
      <div>
        <h2 className="text-xl font-bold text-foreground" data-testid="text-step-title">{title}</h2>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>

      {showForm && (
        <div className="space-y-4">
          {children}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onProcess}
              disabled={isProcessing}
              className="bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20 rounded-xl px-6"
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
        <div className="rounded-2xl border-2 border-dashed border-primary/30 p-8 flex flex-col items-center justify-center bg-primary/5">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="mt-4 font-medium text-primary animate-pulse">AI đang xử lý...</p>
          <p className="text-xs text-muted-foreground mt-1">Tạo hình ảnh có thể mất 30-60 giây. Vui lòng chờ.</p>
        </div>
      )}

      {stepStatus === "error" && (
        <div className="rounded-2xl border-2 border-red-200 p-4 bg-red-50">
          <p className="text-sm text-red-700 font-medium">Có lỗi xảy ra. Bấm "AI Xử lý" để thử lại.</p>
        </div>
      )}

      {showResult && resultContent && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-white/80 p-5" data-testid="step-result">
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
                className="rounded-xl px-6"
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
