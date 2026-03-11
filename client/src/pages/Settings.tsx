import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, Upload, Trash2, FileText, Brain, CreditCard, Loader2, AlertCircle, Lock, Eye, EyeOff, FolderSync, CheckCircle, XCircle, Database, BookOpen } from "lucide-react";
import { useRef } from "react";

interface KnowledgeFile {
  id: number;
  name: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Settings() {
  const { toast } = useToast();
  const [instructions, setInstructions] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleVerifyPassword = async () => {
    setIsVerifying(true);
    setPasswordError("");
    try {
      const res = await apiRequest("POST", "/api/settings/verify-password", { password });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem("settings_auth", "true");
      }
    } catch {
      setPasswordError("Mật khẩu không đúng");
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem("settings_auth") === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const settingsQuery = useQuery<{ instructions: string }>({
    queryKey: ["/api/settings/ai"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setInstructions(settingsQuery.data.instructions || "");
    }
  }, [settingsQuery.data]);

  const filesQuery = useQuery<KnowledgeFile[]>({
    queryKey: ["/api/knowledge-files"],
    enabled: isAuthenticated,
  });

  const saveMutation = useMutation({
    mutationFn: async (newInstructions: string) => {
      await apiRequest("PUT", "/api/settings/ai", { instructions: newInstructions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ai"] });
      toast({ title: "Đã lưu", description: "Instructions đã được cập nhật" });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể lưu settings", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/knowledge-files", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
      toast({ title: "Đã tải lên", description: "File tri thức đã được thêm" });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể tải file", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/knowledge-files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
      toast({ title: "Đã xóa", description: "File tri thức đã được xóa" });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể xóa file", variant: "destructive" });
    },
  });

  const handleFileUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.csv,.json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) uploadMutation.mutate(file);
    };
    input.click();
  };

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-20" data-testid="page-settings-login">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Truy cập Cài đặt</CardTitle>
              <CardDescription>Vui lòng nhập mật khẩu để truy cập trang cài đặt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleVerifyPassword(); }}
                  placeholder="Nhập mật khẩu..."
                  className="w-full rounded-xl border border-border px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-settings-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-sm text-red-500 flex items-center gap-1" data-testid="text-password-error">
                  <AlertCircle className="w-3.5 h-3.5" /> {passwordError}
                </p>
              )}
              <Button
                onClick={handleVerifyPassword}
                disabled={!password.trim() || isVerifying}
                className="w-full rounded-xl h-11"
                data-testid="button-verify-password"
              >
                {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                Xác nhận
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6" data-testid="page-settings">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-settings-title">Cài đặt</h1>
          <p className="text-muted-foreground mt-1">Quản lý AI Instructions và file tri thức</p>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <CardTitle>Thư viện Mẫu</CardTitle>
                <CardDescription>Học từ các mẫu thiết kế trong Drive</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TemplatesComponent />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>AI Instructions</CardTitle>
                <CardDescription>
                  Hướng dẫn tùy chỉnh cho AI. Nội dung này sẽ được thêm vào mọi cuộc hội thoại AI.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ví dụ: Luôn trả lời bằng tiếng Việt. Ưu tiên phong cách hiện đại minimalist. Dự toán chi phí theo giá thị trường TP.HCM năm 2024-2025..."
              className="min-h-[200px] resize-y"
              data-testid="input-instructions"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {instructions.length} ký tự
              </p>
              <Button
                onClick={() => saveMutation.mutate(instructions)}
                disabled={saveMutation.isPending}
                data-testid="button-save-instructions"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Lưu Instructions
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle>File tri thức</CardTitle>
                  <CardDescription>
                    Upload file văn bản để AI tham khảo khi xử lý. Hỗ trợ .txt, .md, .csv, .json (tối đa 5MB)
                  </CardDescription>
                </div>
              </div>
              <Button
                onClick={handleFileUpload}
                disabled={uploadMutation.isPending}
                variant="outline"
                data-testid="button-upload-knowledge"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Tải file lên
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filesQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !filesQuery.data || filesQuery.data.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Chưa có file tri thức nào</p>
                <p className="text-sm mt-1">Upload file văn bản (.txt, .md, .csv, .json) để AI có thêm dữ liệu tham khảo</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filesQuery.data.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                    data-testid={`row-knowledge-file-${file.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">{file.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.fileType} • {formatFileSize(file.fileSize)} • {new Date(file.createdAt).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(file.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-file-${file.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <CardTitle>Xử lý tri thức từ Drive (OCR)</CardTitle>
                <CardDescription>
                  Trích xuất text từ PDF, DOCX, hình ảnh trong Google Drive → lưu vào kho tri thức AI
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DriveOcrProcessor />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <CardTitle>Thanh toán</CardTitle>
                <CardDescription>
                  Quản lý gói dịch vụ và thanh toán qua Stripe
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <StripeProducts />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

interface OcrProgress {
  total: number;
  processed: number;
  current: string;
  results: { name: string; chars: number; status: "ok" | "empty" | "error" }[];
  done: boolean;
  notStarted?: boolean;
}

function DriveOcrProcessor() {
  const { toast } = useToast();
  const pollingRef = useRef<any>(null);

  const progressQuery = useQuery<OcrProgress>({
    queryKey: ["/api/drive-ocr/progress"],
    refetchInterval: (data: any) => {
      if (!data || data.notStarted || data.done) return false;
      return 2000;
    },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/drive-ocr/process");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Bắt đầu xử lý OCR", description: "Đang trích xuất text từ tất cả files Drive..." });
      queryClient.invalidateQueries({ queryKey: ["/api/drive-ocr/progress"] });
      pollingRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/drive-ocr/progress"] });
      }, 2000);
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể bắt đầu xử lý OCR", variant: "destructive" });
    },
  });

  const progress = progressQuery.data;
  const isRunning = progress && !progress.done && !progress.notStarted;
  const pct = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  if (isRunning === false && progress?.done && pollingRef.current) {
    clearInterval(pollingRef.current);
    pollingRef.current = null;
  }

  return (
    <div className="space-y-4" data-testid="section-drive-ocr">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {progress?.notStarted && "Chưa xử lý. Nhấn nút để bắt đầu trích xuất text từ tất cả files."}
          {isRunning && (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
              Đang xử lý... ({progress.processed}/{progress.total}) {progress.current && `— ${progress.current.split("/").pop()}`}
            </span>
          )}
          {progress?.done && !progress.notStarted && (
            <span className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              Hoàn tất! {progress.results.filter(r => r.status === "ok").length}/{progress.total} files đọc được
            </span>
          )}
        </div>
        <Button
          onClick={() => processMutation.mutate()}
          disabled={processMutation.isPending || !!isRunning}
          variant={progress?.done && !progress.notStarted ? "outline" : "default"}
          className="gap-2"
          data-testid="button-ocr-process"
        >
          {isRunning ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Đang xử lý...</>
          ) : (
            <><FolderSync className="w-4 h-4" />{progress?.done && !progress.notStarted ? "Xử lý lại" : "Bắt đầu OCR"}</>
          )}
        </Button>
      </div>

      {isRunning && progress.total > 0 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {progress?.results && progress.results.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {progress.results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/50" data-testid={`row-ocr-result-${i}`}>
              {r.status === "ok" ? (
                <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
              ) : r.status === "empty" ? (
                <AlertCircle className="w-3 h-3 text-yellow-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
              )}
              <span className="text-muted-foreground truncate flex-1">{r.name.split("/").pop()}</span>
              {r.chars > 0 && <span className="text-green-600 font-medium flex-shrink-0">{r.chars.toLocaleString()} ký tự</span>}
              {r.status === "empty" && <span className="text-yellow-600 flex-shrink-0">Không có text</span>}
              {r.status === "error" && <span className="text-red-600 flex-shrink-0">Lỗi</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplatesComponent() {
  const templatesQuery = useQuery<any[]>({
    queryKey: ["/api/templates"],
    retry: false,
  });

  const [learned, setLearned] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("learned_templates") || "[]";
    setLearned(JSON.parse(saved));
  }, []);

  const handleLearn = (name: string) => {
    const updated = learned.includes(name) 
      ? learned.filter(t => t !== name)
      : [...learned, name];
    setLearned(updated);
    localStorage.setItem("learned_templates", JSON.stringify(updated));
  };

  if (templatesQuery.isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const templates = templatesQuery.data || [];
  const learningCount = templates.filter(t => learned.includes(t.name)).length;

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/5 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-foreground">
          Đã học: <span className="font-bold text-blue-600">{learningCount}/{templates.length}</span> mẫu
        </p>
      </div>
      
      {templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Chưa có mẫu nào trong thư viện</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {templates.slice(0, 15).map((template) => (
            <div key={template.name} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{template.name}</p>
                <p className="text-xs text-muted-foreground">{template.mimeType || "File"}</p>
              </div>
              <Button
                size="sm"
                variant={learned.includes(template.name) ? "default" : "outline"}
                onClick={() => handleLearn(template.name)}
                className="gap-2 ml-2 flex-shrink-0"
                data-testid={`button-learn-template-${template.name}`}
              >
                {learned.includes(template.name) ? "✓ Đã học" : "Học"}
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">AI sẽ tham khảo các mẫu đã chọn trong các bước xử lý</p>
    </div>
  );
}

function StripeProducts() {
  const { toast } = useToast();

  const productsQuery = useQuery<any[]>({
    queryKey: ["/api/stripe/products"],
    retry: false,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { priceId });
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) window.location.href = data.url;
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể tạo phiên thanh toán", variant: "destructive" });
    },
  });

  if (productsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (productsQuery.isError || !productsQuery.data || productsQuery.data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Chưa có gói dịch vụ nào</p>
        <p className="text-sm mt-1">Các gói dịch vụ sẽ hiển thị tại đây khi được cấu hình</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {productsQuery.data.map((product: any) => {
        const price = product.default_price;
        const amount = price?.unit_amount ? (price.unit_amount / 100).toLocaleString("vi-VN") : "—";
        const currency = price?.currency?.toUpperCase() || "VND";
        return (
          <div
            key={product.id}
            className="p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
            data-testid={`card-product-${product.id}`}
          >
            <h3 className="font-semibold text-foreground">{product.name}</h3>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-lg font-bold text-primary">
                {amount} {currency}
              </span>
              {price?.id && (
                <Button
                  size="sm"
                  onClick={() => checkoutMutation.mutate(price.id)}
                  disabled={checkoutMutation.isPending}
                  data-testid={`button-checkout-${product.id}`}
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Mua ngay"
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
