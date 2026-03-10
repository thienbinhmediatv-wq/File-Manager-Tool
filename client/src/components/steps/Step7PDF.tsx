import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { FileText, Download, Cloud, HardDrive, BookOpen, Image, Calculator, Home, Paintbrush, Camera, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Props {
  project: Project;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  isProcessing: boolean;
  isApproving: boolean;
}

const sectionIcons = [BookOpen, Home, FileCheck, Home, Paintbrush, Camera, Calculator];
const sectionDetails = [
  "Trang bìa, thông tin dự án, mục lục",
  "Đánh giá khu đất, phong thủy, hướng nhà",
  "Layout các tầng, bảng diện tích",
  "Bản vẽ kỹ thuật, thông số",
  "Phối cảnh mặt tiền ngày/đêm/góc 45°",
  "Nội thất phòng khách, ngủ, bếp, tắm",
  "Render 3D chất lượng cao full-page",
  "Bảng dự toán chi phí chi tiết",
];

export function Step7PDF({ project, stepStatus, onProcess, onApprove, onRedo, isProcessing, isApproving }: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const result = project.pdfEstimate as {
    pageCount?: number;
    sections?: string[];
    estimatedSize?: string;
    downloadUrl?: string;
    pdfSource?: string;
    embeddedImages?: number;
  } | null;

  return (
    <StepWrapper
      title="Bước 7: Xuất PDF hồ sơ"
      description="Tổng hợp tất cả kết quả thành file PDF chuyên nghiệp."
      stepStatus={stepStatus}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        result ? (
          <div className="space-y-5">
            <h3 className="font-semibold flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" /> Hồ sơ thiết kế đã hoàn thành
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-xl p-3 text-center">
                <span className="text-xs text-muted-foreground block">Số trang</span>
                <p className="font-bold text-2xl text-blue-700 dark:text-blue-300" data-testid="text-page-count">{result.pageCount}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-xl p-3 text-center">
                <span className="text-xs text-muted-foreground block">Hình ảnh</span>
                <p className="font-bold text-2xl text-purple-700 dark:text-purple-300" data-testid="text-image-count">
                  <Image className="w-5 h-5 inline mr-1" />{result.embeddedImages ?? "15+"}
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-xl p-3 text-center">
                <span className="text-xs text-muted-foreground block">Dung lượng</span>
                <p className="font-bold text-lg text-green-700 dark:text-green-300" data-testid="text-pdf-size">{result.estimatedSize}</p>
              </div>
            </div>

            {result.pdfSource && (
              <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-2" data-testid="text-pdf-source">
                {result.pdfSource === "pdf_generator_api" ? (
                  <><Cloud className="w-3.5 h-3.5" /> Tạo bởi PDF Generator API (Cloud)</>
                ) : (
                  <><HardDrive className="w-3.5 h-3.5" /> Tạo bởi PDFKit — Bao gồm hình full-page, mục lục, dự toán</>
                )}
              </div>
            )}

            {result.sections && (
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">Nội dung hồ sơ:</p>
                <div className="grid grid-cols-1 gap-2">
                  {result.sections.map((s, i) => {
                    const Icon = sectionIcons[i] || FileText;
                    const detail = sectionDetails[i] || "";
                    return (
                      <div key={i} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" data-testid={`section-item-${i}`}>
                        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{s}</p>
                          {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {result.downloadUrl && result.downloadUrl !== "#" && (
              <div className="space-y-3 pt-2">
                {result.pdfSource !== "pdf_generator_api" && (
                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-10"
                    onClick={() => setShowPreview(!showPreview)}
                    data-testid="button-preview-pdf"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    {showPreview ? "Ẩn xem trước" : "Xem trước PDF"}
                  </Button>
                )}

                {showPreview && (
                  <div className="border rounded-xl overflow-hidden bg-white dark:bg-gray-900" style={{ height: "500px" }}>
                    <iframe
                      src={result.downloadUrl}
                      className="w-full h-full"
                      title="PDF Preview"
                    />
                  </div>
                )}

                <a href={`${result.downloadUrl}?download=1`} target="_blank" rel="noopener noreferrer" className="block" download>
                  <Button className="w-full rounded-xl h-12 bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg hover:shadow-xl transition-shadow" data-testid="button-download-pdf">
                    <Download className="w-5 h-5 mr-2" /> Tải xuống hồ sơ PDF ({result.pageCount} trang)
                  </Button>
                </a>
              </div>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800 rounded-xl p-5">
          <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Hồ sơ thiết kế chuyên nghiệp
          </h4>
          <p className="text-sm text-green-700 dark:text-green-300">
            Hệ thống sẽ tạo hồ sơ PDF hoàn chỉnh với 20+ trang bao gồm: trang bìa, mục lục, phân tích hiện trạng, layout mặt bằng, bản vẽ CAD, thiết kế mặt tiền (4 góc nhìn), nội thất (5 phòng), render 3D (6 phối cảnh), và bảng dự toán chi phí chi tiết.
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            Tất cả hình ảnh AI được nhúng full-page chất lượng cao, tương tự hồ sơ thiết kế chuyên nghiệp thực tế.
          </p>
        </div>
      </div>
    </StepWrapper>
  );
}
