import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  project: Project;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step7PDF({ project, stepStatus, onProcess, onApprove, onRedo, isProcessing, isApproving }: Props) {
  const result = project.pdfEstimate as {
    pageCount?: number;
    sections?: string[];
    estimatedSize?: string;
    downloadUrl?: string;
  } | null;

  return (
    <StepWrapper
      title="Bước 7: Xuất PDF hồ sơ"
      description="Tổng hợp tất cả kết quả thành file PDF hoàn chỉnh."
      stepStatus={stepStatus}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        result ? (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Hồ sơ PDF đã tạo
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">Số trang</span>
                <p className="font-semibold text-lg">{result.pageCount} trang</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">Dung lượng</span>
                <p className="font-semibold text-lg">{result.estimatedSize}</p>
              </div>
            </div>

            {result.sections && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Nội dung bao gồm:</p>
                <div className="space-y-1.5">
                  {result.sections.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.downloadUrl && result.downloadUrl !== "#" && (
              <a href={result.downloadUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full rounded-xl h-12 bg-gradient-to-r from-primary to-accent text-white shadow-lg" data-testid="button-download-pdf">
                  <Download className="w-4 h-4 mr-2" /> Tải xuống PDF
                </Button>
              </a>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700">
            Hồ sơ PDF sẽ tổng hợp tất cả: phân tích, layout, bản vẽ CAD, mặt tiền, nội thất, render phối cảnh và dự toán chi phí.
          </p>
        </div>
      </div>
    </StepWrapper>
  );
}
