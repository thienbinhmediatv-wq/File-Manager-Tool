import { useState, useRef } from "react";
import { Upload, FileText, Link as LinkIcon, X, File } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";

const REQUIREMENTS = [
  { id: "fengShui", label: "Phong thủy" },
  { id: "altarRoom", label: "Phòng thờ" },
  { id: "garage", label: "Gara xe" },
  { id: "office", label: "Phòng làm việc" },
  { id: "garden", label: "Sân vườn" },
  { id: "pool", label: "Hồ bơi" },
  { id: "rooftop", label: "Sân thượng" },
  { id: "basement", label: "Tầng hầm" },
];

interface UploadedFile {
  originalName: string;
  filename: string;
  url: string;
  size: number;
  type: string;
}

interface Props {
  project: Project;
  onNext: (data: { siteRequirements: Record<string, boolean>; budgetSheetUrl: string; uploadedFiles: UploadedFile[] }) => void;
  onBack: () => void;
  onSubmitField: (data: Record<string, unknown>) => void;
}

export function Step1Sub3Requirements({ project, onNext, onBack, onSubmitField }: Props) {
  const [requirements, setRequirements] = useState<Record<string, boolean>>(
    (project.siteRequirements as Record<string, boolean>) || {}
  );
  const [budgetUrl, setBudgetUrl] = useState(project.budgetSheetUrl || "");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(
    (project.uploadedFiles as UploadedFile[]) || []
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleToggle = (id: string) => {
    const updated = { ...requirements, [id]: !requirements[id] };
    setRequirements(updated);
    onSubmitField({ siteRequirements: updated });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const resp = await fetch("/api/upload", { method: "POST", body: formData });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || "Upload failed");
      }
      const data = await resp.json();
      const newFiles = [...uploadedFiles, ...data.files];
      setUploadedFiles(newFiles);
      onSubmitField({ uploadedFiles: newFiles });
      toast({ title: "Upload thành công", description: `${data.files.length} file đã được tải lên.` });
    } catch (err) {
      toast({ title: "Lỗi upload", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onSubmitField({ uploadedFiles: newFiles });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  };

  const isImage = (type: string) => type.startsWith("image/");
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleContinue = () => {
    onNext({ siteRequirements: requirements, budgetSheetUrl: budgetUrl, uploadedFiles });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1" data-testid="text-sub3-title">Yêu cầu đặc biệt</h3>
        <p className="text-sm text-muted-foreground">Bổ sung yêu cầu thiết kế và tài liệu tham khảo.</p>
      </div>

      <div>
        <Label className="font-semibold mb-3 block">Yêu cầu đặc biệt</Label>
        <div className="grid grid-cols-2 gap-3">
          {REQUIREMENTS.map(req => (
            <label key={req.id} className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors" data-testid={`checkbox-req-${req.id}`}>
              <Checkbox
                checked={requirements[req.id] || false}
                onCheckedChange={() => handleToggle(req.id)}
              />
              <span className="text-sm font-medium">{req.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label className="font-semibold mb-2 block">Upload hình ảnh, sổ đỏ, bản vẽ, video...</Label>
        <label
          className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer block"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          data-testid="upload-area"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.dwg,.dxf,video/*"
            className="sr-only"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
            data-testid="input-file-upload"
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-primary">Đang tải lên...</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nhấn để chọn file hoặc kéo thả vào đây</p>
              <p className="text-xs text-muted-foreground mt-1">Hình ảnh, PDF, DWG, Video (tối đa 20MB)</p>
            </>
          )}
        </label>

        {uploadedFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            {uploadedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5" data-testid={`uploaded-file-${i}`}>
                {isImage(f.type) ? (
                  <img src={f.url} alt={f.originalName} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    {f.type === "application/pdf" ? <FileText className="w-5 h-5 text-red-500" /> : <File className="w-5 h-5 text-muted-foreground" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.originalName}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Xem</a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 shrink-0"
                  onClick={() => handleRemoveFile(i)}
                  data-testid={`button-remove-file-${i}`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="font-semibold mb-2 block">
          <FileText className="w-4 h-4 inline mr-1" /> File dự toán (PDF)
        </Label>
        <label className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors cursor-pointer block">
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
            data-testid="input-pdf-upload"
          />
          <p className="text-sm text-muted-foreground">Nhấn để upload file dự toán PDF</p>
        </label>
      </div>

      <div>
        <Label className="font-semibold mb-2 block">
          <LinkIcon className="w-4 h-4 inline mr-1" /> Hoặc nhập link Google Sheet dự toán
        </Label>
        <Input
          value={budgetUrl}
          onChange={(e) => setBudgetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="h-11 rounded-xl"
          data-testid="input-budget-url"
        />
      </div>

      <div className="pt-3 flex justify-between">
        <Button type="button" variant="outline" className="rounded-xl px-6" onClick={onBack} data-testid="button-back-sub3">
          ← Quay lại
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          className="rounded-xl px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25"
          data-testid="button-continue-sub3"
        >
          Tiếp tục →
        </Button>
      </div>
    </div>
  );
}
