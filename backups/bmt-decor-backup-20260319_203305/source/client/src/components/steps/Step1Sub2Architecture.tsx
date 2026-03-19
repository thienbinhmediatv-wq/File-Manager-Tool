import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@shared/schema";

interface ArchitectureOption {
  name: string;
  image: string;
  interiorStyles: string[];
}

const ARCHITECTURE_BY_FLOORS: Record<string, ArchitectureOption[]> = {
  "1": [
    { name: "Nhà cấp 4 hiện đại", image: "/images/architecture/1tang/NhaCap4HienDai.svg", interiorStyles: ["Modern", "Minimalist", "Scandinavian"] },
    { name: "Nhà cấp 4 mái bằng", image: "/images/architecture/1tang/NhaCap4MaiBang.svg", interiorStyles: ["Modern", "Industrial", "Minimalist"] },
    { name: "Nhà cấp 4 mái thái", image: "/images/architecture/1tang/NhaCap4MaiThai.svg", interiorStyles: ["Indochine", "Wabi Sabi", "Tropical"] },
    { name: "Nhà cấp 4 sân vườn", image: "/images/architecture/1tang/NhaCap4SanVuon.svg", interiorStyles: ["Tropical", "Scandinavian", "Wabi Sabi"] },
  ],
  "2": [
    { name: "Hiện đại mái bằng", image: "/images/architecture/2tang/HienDaiMaiBang.svg", interiorStyles: ["Modern", "Minimalist", "Industrial"] },
    { name: "Hiện đại mái lệch", image: "/images/architecture/2tang/HienDaiMaiLech.svg", interiorStyles: ["Modern", "Scandinavian", "Minimalist"] },
    { name: "Phố cổ truyền thống", image: "/images/architecture/2tang/PhoCoTruyenThong.svg", interiorStyles: ["Indochine", "Neoclassic", "Wabi Sabi"] },
    { name: "Biệt thự sân vườn", image: "/images/architecture/2tang/BienhThuSanVuon.svg", interiorStyles: ["Tropical", "Modern", "Scandinavian"] },
  ],
  "3": [
    { name: "Hiện đại công nghiệp", image: "/images/architecture/3tang/HienDaiCongNghiep.svg", interiorStyles: ["Industrial", "Modern", "Minimalist"] },
    { name: "Tân cổ điển mái ngói", image: "/images/architecture/3tang/TanCoienMaiNgoi.svg", interiorStyles: ["Neoclassic", "Indochine", "Wabi Sabi"] },
    { name: "Biệt thự song lập", image: "/images/architecture/3tang/BienhThuSongLap.svg", interiorStyles: ["Modern", "Scandinavian", "Tropical"] },
    { name: "Nhà phố 3 tầng", image: "/images/architecture/3tang/NhaPho3Tang.svg", interiorStyles: ["Modern", "Minimalist", "Industrial"] },
  ],
  "4-5": [
    { name: "Biệt thự lớn hiện đại", image: "/images/architecture/4-5tang/BienhThuLonHienDai.svg", interiorStyles: ["Modern", "Minimalist", "Scandinavian"] },
    { name: "Nhà phố cao tầng", image: "/images/architecture/4-5tang/NhaPhoCaoTang.svg", interiorStyles: ["Modern", "Industrial", "Minimalist"] },
    { name: "Công trình kết hợp", image: "/images/architecture/4-5tang/CongTrinhKetHop.svg", interiorStyles: ["Modern", "Industrial", "Neoclassic"] },
    { name: "Biệt thự tân cổ điển", image: "/images/architecture/4-5tang/BienhThuTanCoDien.svg", interiorStyles: ["Neoclassic", "Indochine", "Wabi Sabi"] },
  ],
};

function getFloorKey(floors: number): string {
  if (floors <= 1) return "1";
  if (floors === 2) return "2";
  if (floors === 3) return "3";
  return "4-5";
}

interface Props {
  project: Project;
  onNext: (architecture: { name: string; image: string }, interiorStyle: string) => void;
  onBack: () => void;
  isPending: boolean;
}

export function Step1Sub2Architecture({ project, onNext, onBack, isPending }: Props) {
  const floorKey = getFloorKey(project.floors);
  const options = ARCHITECTURE_BY_FLOORS[floorKey] || ARCHITECTURE_BY_FLOORS["2"];

  const [selectedArch, setSelectedArch] = useState<ArchitectureOption | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("");

  const handleContinue = () => {
    if (!selectedArch || !selectedStyle) return;
    onNext({ name: selectedArch.name, image: selectedArch.image }, selectedStyle);
  };

  const floorLabel = project.floors >= 4 ? "4-5" : String(project.floors);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1" data-testid="text-sub2-title">Kiến trúc & Nội thất</h3>
        <p className="text-sm text-muted-foreground">
          Chọn kiểu kiến trúc phù hợp cho nhà <strong>{floorLabel} tầng</strong> và phong cách nội thất yêu thích.
        </p>
      </div>

      <div>
        <label className="font-semibold text-sm mb-3 block">Chọn kiến trúc ({options.length} mẫu cho {floorLabel} tầng)</label>
        <div className="grid grid-cols-2 gap-4">
          {options.map((arch) => {
            const isSelected = selectedArch?.name === arch.name;
            return (
              <button
                key={arch.name}
                type="button"
                onClick={() => { setSelectedArch(arch); setSelectedStyle(""); }}
                className={cn(
                  "relative rounded-2xl border-2 overflow-hidden transition-all text-left group",
                  isSelected
                    ? "border-primary shadow-lg shadow-primary/20"
                    : "border-border hover:border-primary/30 hover:shadow-md"
                )}
                data-testid={`card-arch-${arch.name}`}
              >
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <img
                    src={arch.image}
                    alt={arch.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-foreground">{arch.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nội thất gợi ý: {arch.interiorStyles.join(", ")}
                  </p>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedArch && (
        <div>
          <label className="font-semibold text-sm mb-3 block">Chọn phong cách nội thất cho "{selectedArch.name}"</label>
          <div className="flex flex-wrap gap-3">
            {selectedArch.interiorStyles.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setSelectedStyle(style)}
                className={cn(
                  "px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                  selectedStyle === style
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/30 text-muted-foreground"
                )}
                data-testid={`button-style-${style}`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 flex justify-between">
        <Button type="button" variant="outline" className="rounded-xl px-6" onClick={onBack} data-testid="button-back-sub2">
          ← Quay lại
        </Button>
        <Button
          type="button"
          disabled={!selectedArch || !selectedStyle || isPending}
          onClick={handleContinue}
          className="rounded-xl px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25"
          data-testid="button-continue-sub2"
        >
          Tiếp tục →
        </Button>
      </div>
    </div>
  );
}
