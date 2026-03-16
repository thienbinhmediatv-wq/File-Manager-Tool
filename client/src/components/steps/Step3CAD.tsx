import { StepWrapper } from "./StepWrapper";
import type { Project } from "@shared/schema";
import { FileText, Ruler, Layers, Grid3X3, ArrowUpDown, Building2, Download, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  project: Project;
  stepStatus: string;
  onProcess: () => void;
  onApprove: () => void;
  onRedo: () => void;
  onGoBack?: () => void;
  backLabel?: string;
  isProcessing: boolean;
  isApproving: boolean;
}

export function Step3CAD({ project, stepStatus, onProcess, onApprove, onRedo, onGoBack, backLabel, isProcessing, isApproving }: Props) {
  const cadResult = project.cadResult as {
    cadDrawings?: Array<{ name: string; type: string; imageUrl?: string; floor?: number }>;
    svgFloorplans?: Array<{ floor: number; floorLabel: string; svgUrl: string }>;
    cadDescription?: string;
    dimensions?: {
      totalArea: number;
      wallThickness: number;
      floorHeight: number;
      setback?: string;
      stairSteps?: number;
      titleBlock?: string;
      layers?: string[];
      scale?: string;
    };
  } | null;

  const hasSVG = (cadResult?.svgFloorplans?.length ?? 0) > 0;

  return (
    <StepWrapper
      title="Bước 3: Bản vẽ CAD 2D chuẩn A/E"
      description="AI tạo mặt bằng từng tầng với title block BMT DECOR, dimension 3 lớp, grid references chuẩn kiến trúc."
      stepStatus={stepStatus}
      onProcess={onProcess}
      onApprove={onApprove}
      onRedo={onRedo}
      onGoBack={onGoBack}
      backLabel={backLabel}
      isProcessing={isProcessing}
      isApproving={isApproving}
      resultContent={
        cadResult ? (
          <div className="space-y-5">

            {/* Technical Specs Bar */}
            {cadResult.dimensions && (
              <div className="bg-slate-900 text-white rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-orange-400" />
                  <span className="font-bold text-sm text-orange-400">THÔNG SỐ KỸ THUẬT — BMT DECOR STANDARD</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between bg-slate-800 rounded p-2">
                    <span className="text-slate-400">Tổng diện tích sàn</span>
                    <span className="font-bold text-white">{cadResult.dimensions.totalArea} m²</span>
                  </div>
                  <div className="flex justify-between bg-slate-800 rounded p-2">
                    <span className="text-slate-400">Cao tầng thông thủy</span>
                    <span className="font-bold text-white">{cadResult.dimensions.floorHeight}m</span>
                  </div>
                  <div className="flex justify-between bg-slate-800 rounded p-2">
                    <span className="text-slate-400">Khoảng lùi</span>
                    <span className="font-bold text-orange-300">{cadResult.dimensions.setback || "1.2m"}</span>
                  </div>
                  <div className="flex justify-between bg-slate-800 rounded p-2">
                    <span className="text-slate-400">Bậc cầu thang (Sinh)</span>
                    <span className="font-bold text-orange-300">{cadResult.dimensions.stairSteps || 19} bậc × 17cm</span>
                  </div>
                  <div className="flex justify-between bg-slate-800 rounded p-2">
                    <span className="text-slate-400">Tỉ lệ bản vẽ</span>
                    <span className="font-bold text-white">{cadResult.dimensions.scale || "1/100"}</span>
                  </div>
                  <div className="flex justify-between bg-slate-800 rounded p-2">
                    <span className="text-slate-400">Tường ngoài / trong</span>
                    <span className="font-bold text-white">{cadResult.dimensions.wallThickness * 1000 || 200}mm / 100mm</span>
                  </div>
                </div>
                {cadResult.dimensions.layers && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {cadResult.dimensions.layers.map(l => (
                      <Badge key={l} variant="outline" className="text-xs border-orange-400/50 text-orange-300 bg-orange-950/30">
                        {l}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-xs border-slate-500 text-slate-300">
                      DIMENSION 3 LỚP
                    </Badge>
                    <Badge variant="outline" className="text-xs border-slate-500 text-slate-300">
                      GRID REFS
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* SVG Vector Floor Plans (Geometry-based) */}
            {hasSVG && (
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <GitBranch className="w-4 h-4 text-green-600" />
                  Mặt bằng Vector (Geometry Engine)
                  <Badge className="bg-green-100 text-green-700 text-xs">SVG · Dữ liệu thực</Badge>
                </h3>
                <div className="space-y-4">
                  {cadResult?.svgFloorplans?.map((svgFp, i) => (
                    <div key={i} className="rounded-xl overflow-hidden border-2 border-green-200 shadow-sm" data-testid={`svg-floorplan-${i}`}>
                      <div className="bg-green-800 text-white px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-green-300" />
                          <span className="font-bold text-sm">{svgFp.floorLabel} — Vector CAD</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-green-300 text-green-200">Geometry-based</Badge>
                          <a
                            href={svgFp.svgUrl}
                            download={`mat-bang-tang-${svgFp.floor}.svg`}
                            className="flex items-center gap-1 text-xs text-green-200 hover:text-white transition-colors"
                            data-testid={`download-svg-${i}`}
                          >
                            <Download className="w-3 h-3" />
                            Tải SVG
                          </a>
                        </div>
                      </div>
                      <div className="bg-white p-2 overflow-x-auto">
                        <img
                          src={svgFp.svgUrl}
                          alt={`Mặt bằng ${svgFp.floorLabel}`}
                          className="w-full object-contain"
                          style={{ minHeight: "280px", maxHeight: "600px" }}
                        />
                      </div>
                      <div className="bg-green-50 border-t border-green-200 px-4 py-2 text-xs text-green-700 flex justify-between">
                        <span>Tọa độ phòng: X, Y thực tế</span>
                        <span>Tường: 200mm ngoài / 120mm trong</span>
                        <span>BMT DECOR Geometry Engine v1</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CAD Floor Plan Images */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-primary" />
                Bản vẽ Mặt bằng từng tầng
                {hasSVG ? (
                  <Badge className="bg-slate-100 text-slate-600 text-xs">AI Reference</Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-700 text-xs">A/E Standard</Badge>
                )}
              </h3>

              <div className="space-y-4">
                {cadResult.cadDrawings?.map((d, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm" data-testid={`cad-drawing-${i}`}>
                    {/* Drawing header */}
                    <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Grid3X3 className="w-4 h-4 text-orange-400" />
                        <span className="font-bold text-sm">{d.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs border-orange-400 text-orange-300">TỈ LỆ 1/100</Badge>
                        <Badge variant="outline" className="text-xs border-slate-400 text-slate-300">
                          KT-{String(i + 1).padStart(2, "0")}
                        </Badge>
                      </div>
                    </div>

                    {/* Floor plan image */}
                    {d.imageUrl && (
                      <div className="bg-white p-2">
                        <img
                          src={d.imageUrl}
                          alt={d.name}
                          className="w-full object-contain bg-white"
                          style={{ minHeight: "300px", maxHeight: "600px" }}
                        />
                      </div>
                    )}

                    {/* Drawing footer - Title Block info */}
                    <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-600">
                      <span>DIRECTOR: Võ Quốc Bảo</span>
                      <span>BMT DECOR — 7/92 Thành Thái, P.14, Q.10, TP.HCM</span>
                      <span>SỐ BẢN VẼ: KT-{String(i + 1).padStart(2, "0")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Description */}
            {cadResult.cadDescription && (
              <div>
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Mô tả kỹ thuật chi tiết
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto font-mono text-blue-900">
                  {cadResult.cadDescription}
                </div>
              </div>
            )}

            {/* Dimension Legend */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Ruler className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-600 font-bold">LỚP 1</span>
                </div>
                <p className="text-xs text-orange-700">Tổng thể khu đất theo Sổ đỏ</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Ruler className="w-3 h-3 text-blue-500" />
                  <span className="text-xs text-blue-600 font-bold">LỚP 2</span>
                </div>
                <p className="text-xs text-blue-700">Kích thước thông thủy từng phòng</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowUpDown className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-600 font-bold">LỚP 3</span>
                </div>
                <p className="text-xs text-green-700">Chi tiết khoảng lùi {cadResult.dimensions?.setback || "1.2m"}</p>
              </div>
            </div>

          </div>
        ) : null
      }
    >
      <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
        <p className="font-medium">AI sẽ tạo bản vẽ CAD 2D chuẩn A/E bao gồm:</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-start gap-2">
            <Grid3X3 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Mặt bằng từng tầng</p>
              <p className="text-xs text-muted-foreground">Tường, cột, cửa đi, cầu thang</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Ruler className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Dimension 3 lớp</p>
              <p className="text-xs text-muted-foreground">Tổng thể, phòng, khoảng lùi</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Layers className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Title Block chuẩn BMT</p>
              <p className="text-xs text-muted-foreground">Lề phải, đầy đủ thông tin</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Cầu thang số Sinh</p>
              <p className="text-xs text-muted-foreground">Bậc 16-18cm, thông thủy &gt;2.2m</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mt-2">
          <Badge variant="outline" className="text-xs">A-WALL</Badge>
          <Badge variant="outline" className="text-xs">A-COLM</Badge>
          <Badge variant="outline" className="text-xs">A-DIM</Badge>
          <Badge variant="outline" className="text-xs">A-BOUND</Badge>
          <Badge variant="outline" className="text-xs bg-orange-50">TỈ LỆ 1/100</Badge>
        </div>
      </div>
    </StepWrapper>
  );
}
