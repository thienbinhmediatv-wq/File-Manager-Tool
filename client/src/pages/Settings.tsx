import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, Upload, Trash2, FileText, Brain, CreditCard, Loader2, AlertCircle, Lock, Eye, EyeOff, FolderSync, CheckCircle, XCircle, Database, BookOpen, Link as LinkIcon, Tag, Sparkles, BarChart2, X, Plus } from "lucide-react";
import { useRef } from "react";

interface KnowledgeFile {
  id: number;
  name: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  tags: string[] | null;
  source: string;
  createdAt: string;
}

interface KnowledgeStats {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
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

  const statsQuery = useQuery<KnowledgeStats>({
    queryKey: ["/api/knowledge-stats"],
    enabled: isAuthenticated,
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ id, tags }: { id: number; tags: string[] }) => {
      const res = await apiRequest("PATCH", `/api/knowledge-files/${id}/tags`, { tags });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
    },
  });

  const autoTagMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/knowledge-files/${id}/auto-tag`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-stats"] });
      toast({ title: "AI đã gắn tag", description: "Tags được tạo tự động bởi AI" });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể tạo tag tự động", variant: "destructive" });
    },
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
      <div className="max-w-4xl mx-auto" data-testid="page-settings">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-settings-title">Cài đặt</h1>
          <p className="text-muted-foreground mt-1">Quản lý AI Instructions và file tri thức</p>
        </div>

        <Tabs defaultValue="knowledge" className="space-y-5">
          <TabsList className="bg-muted/60 dark:bg-muted/30 p-1 rounded-xl h-auto gap-1">
            <TabsTrigger value="knowledge" className="rounded-lg gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm" data-testid="tab-knowledge">
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Kho Tri Thức</span>
              <span className="sm:hidden">Tri Thức</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="rounded-lg gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm" data-testid="tab-ai">
              <Brain className="w-4 h-4" />
              <span className="hidden sm:inline">AI Settings</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="rounded-lg gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm" data-testid="tab-payment">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Thanh Toán</span>
              <span className="sm:hidden">Thanh Toán</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge" className="space-y-5 mt-0">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">Kho Tri Thức AI</h2>
              <p className="text-sm text-muted-foreground mt-1">Quản lý AI Instructions via file tri thức</p>
            </div>

            {/* Upload Section - Prominent */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Upload Tri Thức</CardTitle>
                    <CardDescription className="text-xs">Hỗ trợ: TXT • MD • JSON • PDF (tối đa 5MB)</CardDescription>
                  </div>
                  <Button onClick={handleFileUpload} disabled={uploadMutation.isPending} className="gap-2" data-testid="button-upload-knowledge">
                    {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span className="hidden sm:inline">Upload File</span>
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Google Drive Section */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Học từ Google Drive Links</CardTitle>
                    <CardDescription className="text-xs">Paste Drive link để AI tham khảo trực tiếp</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DriveLinksLearner />
              </CardContent>
            </Card>

            {/* File Tri Thức - File List with Tags */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">File Tri Thức ({filesQuery.data?.length || 0})</CardTitle>
                      <CardDescription className="text-xs">Danh sách file đã tải lên</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !filesQuery.data || filesQuery.data.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Chưa có file tri thức nào</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filesQuery.data.map((file) => (
                      <FileRowWithTags
                        key={file.id}
                        file={file}
                        onDelete={() => deleteMutation.mutate(file.id)}
                        onAutoTag={() => autoTagMutation.mutate(file.id)}
                        onUpdateTags={(tags) => updateTagsMutation.mutate({ id: file.id, tags })}
                        isDeleting={deleteMutation.isPending}
                        isAutoTagging={autoTagMutation.isPending && autoTagMutation.variables === file.id}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Templates & OCR - Compact */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Thư viện Mẫu</CardTitle>
                      <CardDescription className="text-xs">Mẫu trong Drive</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <TemplatesComponent />
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Database className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Xử lý OCR</CardTitle>
                      <CardDescription className="text-xs">Trích PDF → tri thức</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <DriveOcrProcessor />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-5 mt-0">
            {/* 1. AI Instructions */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">AI Instructions</CardTitle>
                    <CardDescription className="text-xs">Hướng dẫn tùy chỉnh cho AI trong mọi cuộc hội thoại</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Ví dụ: Luôn trả lời bằng tiếng Việt. Ưu tiên phong cách hiện đại minimalist..."
                  className="min-h-[200px] resize-y text-sm"
                  data-testid="input-instructions"
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">{instructions.length} ký tự</p>
                  <Button onClick={() => saveMutation.mutate(instructions)} disabled={saveMutation.isPending} data-testid="button-save-instructions">
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Lưu
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 2. Nguồn Tri Thức AI */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Nguồn Tri Thức AI</CardTitle>
                    <CardDescription className="text-xs">Quản lý các nguồn dữ liệu AI sử dụng để xử lý</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "Files Upload", count: statsQuery.data?.bySource?.upload || 0, color: "text-blue-500", bg: "bg-blue-500/10" },
                    { label: "Google Drive", count: statsQuery.data?.bySource?.drive || 0, color: "text-orange-500", bg: "bg-orange-500/10" },
                    { label: "Tổng cộng", count: statsQuery.data?.total || 0, color: "text-primary", bg: "bg-primary/10" },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl p-3 ${item.bg}`}>
                      <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 3. Trạng thái xử lý tri thức */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Trạng thái xử lý tri thức</CardTitle>
                    <CardDescription className="text-xs">OCR Drive PDF → lưu vào kho tri thức AI</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <DriveOcrProcessor />
              </CardContent>
            </Card>

            {/* 4. Tag AI */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">Tag AI</CardTitle>
                    <CardDescription className="text-xs">AI tự động phân loại tri thức theo tag giúp tìm kiếm nhanh hơn</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!filesQuery.data || filesQuery.data.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Chưa có file nào để gắn tag</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filesQuery.data.slice(0, 8).map((file) => (
                      <div key={file.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate mb-1">{file.originalName}</p>
                          <div className="flex flex-wrap gap-1">
                            {(file.tags || []).map((tag, i) => (
                              <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                {tag}
                                <button onClick={() => {
                                  const newTags = (file.tags || []).filter((_, idx) => idx !== i);
                                  updateTagsMutation.mutate({ id: file.id, tags: newTags });
                                }} className="hover:text-destructive ml-0.5">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => autoTagMutation.mutate(file.id)}
                          disabled={autoTagMutation.isPending}
                          className="h-6 px-2 text-xs shrink-0"
                          data-testid={`button-autotag-${file.id}`}
                        >
                          {autoTagMutation.isPending && autoTagMutation.variables === file.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <><Sparkles className="w-3 h-3 mr-1" />AI Tag</>
                          }
                        </Button>
                      </div>
                    ))}
                    {filesQuery.data.length > 8 && (
                      <p className="text-xs text-center text-muted-foreground pt-1">+{filesQuery.data.length - 8} file khác trong Kho Tri Thức</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 5. Thống kê Kho Tri Thức */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <BarChart2 className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Thống kê Kho Tri Thức</CardTitle>
                    <CardDescription className="text-xs">Phân tích tổng quan dữ liệu AI đang sử dụng</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {statsQuery.isLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                      <span className="text-sm font-medium">Tổng Files</span>
                      <span className="text-2xl font-bold text-primary">{statsQuery.data?.total || 0}</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Theo loại file</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(statsQuery.data?.byType || {}).sort(([,a],[,b]) => b - a).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${type === 'pdf' ? 'bg-red-500' : type === 'md' || type === 'markdown' ? 'bg-blue-500' : type === 'json' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                              <span className="text-xs uppercase font-medium">{type}</span>
                            </div>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Theo nguồn</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(statsQuery.data?.bySource || {}).map(([source, count]) => (
                          <div key={source} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <span className="text-xs capitalize font-medium">{source === 'drive' ? '📁 Drive' : '⬆️ Upload'}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-5 mt-0">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Thanh toán</CardTitle>
                    <CardDescription className="text-xs">Quản lý gói dịch vụ và thanh toán qua Stripe</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <StripeProducts />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function FileRowWithTags({
  file, onDelete, onAutoTag, onUpdateTags, isDeleting, isAutoTagging
}: {
  file: KnowledgeFile;
  onDelete: () => void;
  onAutoTag: () => void;
  onUpdateTags: (tags: string[]) => void;
  isDeleting: boolean;
  isAutoTagging: boolean;
}) {
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const tags = file.tags || [];

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onUpdateTags([...tags, trimmed]);
    }
    setNewTag("");
    setAddingTag(false);
  };

  return (
    <div className="p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-knowledge-file-${file.id}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{file.originalName}</p>
            <p className="text-xs text-muted-foreground">{file.fileType.toUpperCase()} • {formatFileSize(file.fileSize)} • {new Date(file.createdAt).toLocaleDateString("vi-VN")} • {file.source === 'drive' ? '📁 Drive' : '⬆️ Upload'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onAutoTag} disabled={isAutoTagging} className="h-6 px-2 text-xs" data-testid={`button-autotag-${file.id}`}>
            {isAutoTagging ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3 mr-1 text-purple-500" />AI</>}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} disabled={isDeleting} className="h-6 w-6" data-testid={`button-delete-file-${file.id}`}>
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 pl-6">
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400">
            {tag}
            <button onClick={() => onUpdateTags(tags.filter((_, idx) => idx !== i))} className="hover:text-destructive">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        {addingTag ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(); if (e.key === "Escape") setAddingTag(false); }}
              onBlur={() => { if (newTag.trim()) handleAddTag(); else setAddingTag(false); }}
              className="w-20 text-xs border border-purple-300 rounded-full px-2 py-0.5 outline-none focus:ring-1 focus:ring-purple-400"
              placeholder="Tag..."
              data-testid={`input-new-tag-${file.id}`}
            />
          </div>
        ) : (
          <button onClick={() => setAddingTag(true)} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-purple-400 hover:text-purple-500 transition-colors" data-testid={`button-add-tag-${file.id}`}>
            <Plus className="w-2.5 h-2.5" />
            Tag
          </button>
        )}
      </div>
    </div>
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

function DriveLinksLearner() {
  const { toast } = useToast();
  const [driveLink, setDriveLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const filesQuery = useQuery<KnowledgeFile[]>({
    queryKey: ["/api/knowledge-files"],
  });

  const handleAddDriveLink = async () => {
    const link = driveLink.trim();
    if (!link) {
      toast({ title: "Lỗi", description: "Vui lòng nhập Drive link", variant: "destructive" });
      return;
    }

    const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!fileIdMatch) {
      toast({ title: "Lỗi", description: "Link không hợp lệ. Dùng Google Drive share link", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/knowledge-files/from-drive", {
        fileId: fileIdMatch[1],
        fileName: link.split("/").pop() || "Drive File",
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Thành công", description: `Đã thêm file (${data.chars} ký tự) vào thư viện` });
        setDriveLink("");
        queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
      }
    } catch {
      toast({ title: "Lỗi", description: "Không thể thêm file Drive", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const driveFiles = filesQuery.data?.filter(f => f.fileType === "drive") || [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Dán Google Drive link (https://drive.google.com/file/d/...)"
          value={driveLink}
          onChange={(e) => setDriveLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddDriveLink()}
          disabled={isLoading}
          data-testid="input-drive-link"
        />
        <Button
          onClick={handleAddDriveLink}
          disabled={isLoading || !driveLink.trim()}
          className="gap-2"
          data-testid="button-add-drive-link"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LinkIcon className="w-4 h-4" />
          )}
          {isLoading ? "Đang thêm..." : "Thêm"}
        </Button>
      </div>

      {driveFiles.length > 0 && (
        <div className="bg-green-500/5 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-foreground">
            AI đang học từ <span className="font-bold text-green-600">{driveFiles.length}</span> file Drive
          </p>
        </div>
      )}

      {driveFiles.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {driveFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-xs"
              data-testid={`row-drive-file-${file.id}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <LinkIcon className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                <span className="truncate">{file.originalName}</span>
              </div>
              <span className="text-muted-foreground flex-shrink-0">{formatFileSize(file.fileSize)}</span>
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
