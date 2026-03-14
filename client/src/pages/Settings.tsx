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
import {
  Save, Upload, Trash2, FileText, Brain, CreditCard, Loader2, AlertCircle, Lock, Eye, EyeOff,
  FolderSync, CheckCircle, XCircle, Database, BookOpen, Link as LinkIcon, Tag, Sparkles, BarChart2,
  X, Plus, Folder, FolderOpen, RefreshCw, Hash, Layers, Clock, ChevronRight, ChevronDown
} from "lucide-react";
import { useRef } from "react";

interface KnowledgeFile {
  id: number;
  name: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  tags: string[] | null;
  tagsManual: string[] | null;
  categoryId: number | null;
  source: string;
  pendingUpdate: number | null;
  lastUpdated: string | null;
  createdAt: string;
}

interface KnowledgeCategory {
  id: number;
  name: string;
  parentId: number | null;
  icon: string | null;
  color: string | null;
  createdAt: string;
}

interface KnowledgeStats {
  total: number;
  categories: number;
  totalTags: number;
  vectorChunks: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  pendingCount: number;
  indexedAt: string | null;
  pendingReindex: number;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return d.toLocaleDateString("vi-VN");
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  upload: { label: "Upload", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  drive: { label: "Drive", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  google_drive: { label: "Drive", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  telegram_bot: { label: "Telegram", color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  api_sync: { label: "API", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
};

export default function Settings() {
  const { toast } = useToast();
  const [instructions, setInstructions] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null | "all">("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [selectedFilesForCategory, setSelectedFilesForCategory] = useState<number[]>([]);
  const [expandedFilesSection, setExpandedFilesSection] = useState(true);
  const [selectedFileToView, setSelectedFileToView] = useState<KnowledgeFile | null>(null);

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
    refetchInterval: 15000,
  });

  const categoriesQuery = useQuery<KnowledgeCategory[]>({
    queryKey: ["/api/knowledge-categories"],
    enabled: isAuthenticated,
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<KnowledgeFile> }) => {
      const res = await apiRequest("PATCH", `/api/knowledge-files/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-stats"] });
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ id, tags }: { id: number; tags: string[] }) => {
      const res = await apiRequest("PATCH", `/api/knowledge-files/${id}/tags`, { tags });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-stats"] });
      toast({ title: "Đã xóa", description: "File tri thức đã được xóa" });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể xóa file", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/knowledge-categories", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-stats"] });
      setNewCatName("");
      setAddingCat(false);
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể tạo danh mục", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/knowledge-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-stats"] });
    },
  });

  const assignToCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, fileIds }: { categoryId: number; fileIds: number[] }) => {
      await Promise.all(fileIds.map(id => 
        apiRequest("PATCH", `/api/knowledge-files/${id}`, { categoryId })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-stats"] });
      setSelectedFilesForCategory(new Set());
      toast({ title: "Thành công", description: "Đã thêm files vào danh mục" });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể thêm files vào danh mục", variant: "destructive" });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/knowledge/reindex");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-files"] });
      toast({ title: "Đã cập nhật AI Index", description: `${data.indexed} files đã được đánh chỉ mục` });
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể rebuild AI index", variant: "destructive" });
    },
  });

  const handleFileUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.csv,.json,.pdf";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) uploadMutation.mutate(file);
    };
    input.click();
  };

  const allFiles = filesQuery.data || [];
  const categories = categoriesQuery.data || [];

  const filteredFiles = selectedCategoryId === "all"
    ? allFiles
    : selectedCategoryId === null
      ? allFiles.filter(f => !f.categoryId)
      : allFiles.filter(f => f.categoryId === selectedCategoryId);

  const getFilesForCategory = (catId: number) => allFiles.filter(f => f.categoryId === catId).length;
  const uncategorizedCount = allFiles.filter(f => !f.categoryId).length;

  const pendingCount = statsQuery.data?.pendingCount || 0;

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
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />{passwordError}
                </p>
              )}
              <Button
                className="w-full"
                onClick={handleVerifyPassword}
                disabled={isVerifying || !password}
                data-testid="button-verify-password"
              >
                {isVerifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
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
      <div className="max-w-6xl mx-auto py-6 px-4" data-testid="page-settings">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Cài Đặt</h1>
          <p className="text-sm text-muted-foreground mt-1">BMT Decor — Quản lý AI & Kho Tri Thức</p>
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

          {/* ===== KHO TRI THỨC TAB ===== */}
          <TabsContent value="knowledge" className="space-y-5 mt-0">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Kho Tri Thức AI</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Quản lý dữ liệu AI học từ tài liệu, tags và danh mục</p>
              </div>
              <Button onClick={handleFileUpload} disabled={uploadMutation.isPending} className="gap-2" data-testid="button-upload-knowledge">
                {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload File
              </Button>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  icon: <FileText className="w-4 h-4" />,
                  label: "Tổng Files",
                  value: statsQuery.data?.total ?? "—",
                  color: "text-blue-600 dark:text-blue-400",
                  bg: "bg-blue-500/8",
                },
                {
                  icon: <Folder className="w-4 h-4" />,
                  label: "Danh Mục",
                  value: statsQuery.data?.categories ?? "—",
                  color: "text-orange-600 dark:text-orange-400",
                  bg: "bg-orange-500/8",
                },
                {
                  icon: <Hash className="w-4 h-4" />,
                  label: "Tổng Tags",
                  value: statsQuery.data?.totalTags ?? "—",
                  color: "text-purple-600 dark:text-purple-400",
                  bg: "bg-purple-500/8",
                },
                {
                  icon: <Layers className="w-4 h-4" />,
                  label: "Vector Chunks",
                  value: statsQuery.data?.vectorChunks ?? "—",
                  color: "text-green-600 dark:text-green-400",
                  bg: "bg-green-500/8",
                },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl p-3 border border-border/50 ${s.bg} flex items-center gap-3`} data-testid={`stat-${s.label}`}>
                  <div className={`${s.color} opacity-70`}>{s.icon}</div>
                  <div>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reindex bar */}
            {(pendingCount > 0 || statsQuery.data?.indexedAt) && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/8 border border-amber-200/60 dark:border-amber-800/40">
                <div className="text-sm">
                  {pendingCount > 0 ? (
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      {pendingCount} file chờ cập nhật vào AI Index
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      AI Index đã đồng bộ
                      {statsQuery.data?.indexedAt && ` — ${formatRelative(statsQuery.data.indexedAt)}`}
                    </span>
                  )}
                </div>
                <Button
                  variant={pendingCount > 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => reindexMutation.mutate()}
                  disabled={reindexMutation.isPending}
                  className="gap-2"
                  data-testid="button-reindex"
                >
                  {reindexMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {pendingCount > 0 ? "Cập nhật AI" : "Rebuild Index"}
                </Button>
              </div>
            )}

            {/* Upload + Drive row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-sm">Upload Tri Thức</CardTitle>
                      <CardDescription className="text-xs">TXT • MD • JSON • PDF (5MB)</CardDescription>
                    </div>
                    <Button size="sm" onClick={handleFileUpload} disabled={uploadMutation.isPending} className="gap-1.5" data-testid="button-upload-knowledge-2">
                      {uploadMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Upload
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <LinkIcon className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Google Drive Links</CardTitle>
                      <CardDescription className="text-xs">Paste Drive link để AI học</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <DriveLinksLearner />
                </CardContent>
              </Card>
            </div>

            {/* Main: Category Tree + File Table */}
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              {/* Left: Category Tree */}
              <Card className="border-border/50 h-fit">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Folder className="w-4 h-4 text-orange-500" />
                      Danh Mục
                    </CardTitle>
                    <button
                      onClick={() => setAddingCat(true)}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Thêm danh mục"
                      data-testid="button-add-category"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  <div className="space-y-0.5">
                    {/* All Files */}
                    <button
                      onClick={() => setSelectedCategoryId("all")}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${selectedCategoryId === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}
                      data-testid="cat-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5" />
                        Tất cả
                      </span>
                      <span className="text-muted-foreground">{allFiles.length}</span>
                    </button>

                    {/* Uncategorized */}
                    <button
                      onClick={() => setSelectedCategoryId(null)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${selectedCategoryId === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}
                      data-testid="cat-uncategorized"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Chưa phân loại
                      </span>
                      <span>{uncategorizedCount}</span>
                    </button>

                    {/* Categories */}
                    {categories.map((cat) => (
                      <div key={cat.id} className="group">
                        <div className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${selectedCategoryId === cat.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                          <button
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className="flex-1 text-left text-xs flex items-center gap-1.5"
                            data-testid={`cat-${cat.id}`}
                          >
                            <Folder className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            <span className="truncate font-medium">{cat.name}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">{getFilesForCategory(cat.id)}</span>
                            <button
                              onClick={() => deleteCategoryMutation.mutate(cat.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive transition-all"
                              data-testid={`button-delete-cat-${cat.id}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add category form */}
                    {addingCat && (
                      <div className="flex items-center gap-1 pt-1">
                        <Input
                          autoFocus
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newCatName.trim()) createCategoryMutation.mutate(newCatName.trim());
                            if (e.key === "Escape") { setAddingCat(false); setNewCatName(""); }
                          }}
                          placeholder="Tên danh mục..."
                          className="h-7 text-xs"
                          data-testid="input-new-category"
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => newCatName.trim() && createCategoryMutation.mutate(newCatName.trim())}
                          disabled={createCategoryMutation.isPending}
                          data-testid="button-save-category"
                        >
                          {createCategoryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        </Button>
                        <button onClick={() => { setAddingCat(false); setNewCatName(""); }} className="p-1 hover:text-destructive">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {categories.length === 0 && !addingCat && (
                      <p className="text-xs text-muted-foreground px-2 pt-2 pb-1">Chưa có danh mục. Nhấn + để thêm.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Right: File Table */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <button
                    onClick={() => setExpandedFilesSection(!expandedFilesSection)}
                    className="w-full text-left flex items-center justify-between hover:opacity-70 transition-opacity"
                    data-testid="button-toggle-files-section"
                  >
                    <div className="flex items-center gap-2">
                      {expandedFilesSection ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <FileText className="w-4 h-4 text-blue-500" />
                      <CardTitle className="text-sm">
                        {selectedCategoryId === "all" ? "Tất cả Files" :
                         selectedCategoryId === null ? "Chưa phân loại" :
                         categories.find(c => c.id === selectedCategoryId)?.name || "Files"}
                        <span className="ml-2 text-muted-foreground font-normal">({filteredFiles.length})</span>
                      </CardTitle>
                    </div>
                  </button>
                </CardHeader>
                {expandedFilesSection && (
                <CardContent className="pt-0">
                  {filesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Không có file nào</p>
                      <Button variant="ghost" size="sm" onClick={handleFileUpload} className="mt-2 gap-2" data-testid="button-upload-empty">
                        <Upload className="w-3.5 h-3.5" />Upload ngay
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFiles.map((file) => (
                        <KnowledgeFileRow
                          key={file.id}
                          file={file}
                          categories={categories}
                          onView={() => setSelectedFileToView(file)}
                          onDelete={() => deleteMutation.mutate(file.id)}
                          onAutoTag={() => autoTagMutation.mutate(file.id)}
                          onUpdateAiTags={(tags) => updateTagsMutation.mutate({ id: file.id, tags })}
                          onUpdateManualTags={(tagsManual) => updateFileMutation.mutate({ id: file.id, updates: { tagsManual, pendingUpdate: 1 } as any })}
                          onSetCategory={(categoryId) => updateFileMutation.mutate({ id: file.id, updates: { categoryId } as any })}
                          isDeleting={deleteMutation.isPending}
                          isAutoTagging={autoTagMutation.isPending && autoTagMutation.variables === file.id}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
                )}
              </Card>
            </div>

            {/* Assign Files to Category */}
            {typeof selectedCategoryId === "number" && (
              <Card className="border-orange-200/60 bg-orange-500/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Plus className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">Thêm Files vào "{categories.find(c => c.id === selectedCategoryId)?.name}"</CardTitle>
                      <CardDescription className="text-xs">Chọn các file để thêm vào danh mục này</CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      {selectedFilesForCategory.length} chọn
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filesQuery.isLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {allFiles
                          .filter(f => f.categoryId !== selectedCategoryId)
                          .map(file => (
                            <label
                              key={file.id}
                              className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                              data-testid={`checkbox-assign-file-${file.id}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedFilesForCategory.includes(file.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedFilesForCategory([...selectedFilesForCategory, file.id]);
                                  } else {
                                    setSelectedFilesForCategory(selectedFilesForCategory.filter(id => id !== file.id));
                                  }
                                }}
                                className="w-4 h-4 rounded cursor-pointer"
                              />
                              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{file.originalName}</p>
                                <p className="text-xs text-muted-foreground">{file.fileType.toUpperCase()} • {formatFileSize(file.fileSize)}</p>
                              </div>
                            </label>
                          ))}
                        {allFiles.filter(f => f.categoryId !== selectedCategoryId).length === 0 && (
                          <p className="text-center text-xs text-muted-foreground py-4">Tất cả files đều đã được gán hoặc không có files khác</p>
                        )}
                      </div>
                      {selectedFilesForCategory.length > 0 && (
                        <div className="space-y-2">
                          <Button
                            onClick={() => assignToCategoryMutation.mutate({
                              categoryId: selectedCategoryId as number,
                              fileIds: selectedFilesForCategory
                            })}
                            disabled={assignToCategoryMutation.isPending}
                            className="w-full gap-2"
                            data-testid="button-assign-files-to-category"
                          >
                            {assignToCategoryMutation.isPending ? (
                              <><Loader2 className="w-4 h-4 animate-spin" />Đang thêm...</>
                            ) : (
                              <><Plus className="w-4 h-4" />Thêm {selectedFilesForCategory.length} file vào danh mục</>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Templates & OCR */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
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
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
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

          {/* ===== AI SETTINGS TAB ===== */}
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
                    <CardDescription className="text-xs">Tổng hợp các nguồn dữ liệu AI đang sử dụng</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {[
                    { label: "Upload", count: statsQuery.data?.bySource?.upload || 0, color: "text-blue-500", bg: "bg-blue-500/10" },
                    { label: "Google Drive", count: (statsQuery.data?.bySource?.drive || 0) + (statsQuery.data?.bySource?.google_drive || 0), color: "text-orange-500", bg: "bg-orange-500/10" },
                    { label: "Telegram Bot", count: statsQuery.data?.bySource?.telegram_bot || 0, color: "text-sky-500", bg: "bg-sky-500/10" },
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

            {/* 3. Trạng thái OCR */}
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

            {/* 4. Thống kê */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <BarChart2 className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Thống kê Kho Tri Thức</CardTitle>
                    <CardDescription className="text-xs">Phân tích tổng quan dữ liệu AI</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {statsQuery.isLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Files", value: statsQuery.data?.total || 0 },
                        { label: "Danh mục", value: statsQuery.data?.categories || 0 },
                        { label: "Tags", value: statsQuery.data?.totalTags || 0 },
                        { label: "Chunks", value: statsQuery.data?.vectorChunks || 0 },
                      ].map(s => (
                        <div key={s.label} className="text-center p-3 rounded-xl bg-muted/40">
                          <p className="text-2xl font-bold text-primary">{s.value}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
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
                    {statsQuery.data?.indexedAt && (
                      <p className="text-xs text-muted-foreground text-center">
                        Lần cập nhật AI Index gần nhất: {formatRelative(statsQuery.data.indexedAt)}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== PAYMENT TAB ===== */}
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

      {/* File Content Modal */}
      {selectedFileToView && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setSelectedFileToView(null)}>
          <div
            className="bg-white dark:bg-slate-900 w-full sm:w-[90%] lg:w-[70%] max-h-[90vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="modal-file-content"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/50 shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-foreground truncate">{selectedFileToView.originalName}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedFileToView.fileType.toUpperCase()} • {formatFileSize(selectedFileToView.fileSize)}
                </p>
              </div>
              <button
                onClick={() => setSelectedFileToView(null)}
                className="ml-4 p-2 hover:bg-muted rounded-lg transition-colors shrink-0"
                data-testid="button-close-file-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="bg-muted/40 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap break-words max-h-96 overflow-y-auto leading-relaxed text-foreground/80 border border-border/50">
                  {selectedFileToView.content.length > 5000
                    ? selectedFileToView.content.slice(0, 5000) + `\n\n... (${selectedFileToView.content.length - 5000} ký tự tiếp theo được ẩn)`
                    : selectedFileToView.content}
                </div>

                {/* Tags Section */}
                <div className="mt-6 space-y-4">
                  {/* AI Tags */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      <span className="text-xs font-medium text-foreground">AI Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(selectedFileToView.tags || []).length > 0 ? (
                        (selectedFileToView.tags || []).map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            {tag}
                            <button
                              onClick={() => {
                                const newTags = (selectedFileToView.tags || []).filter((_, idx) => idx !== i);
                                updateTagsMutation.mutate({ id: selectedFileToView.id, tags: newTags });
                                setSelectedFileToView({ ...selectedFileToView, tags: newTags });
                              }}
                              className="hover:text-destructive ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Chưa có AI tag</span>
                      )}
                    </div>
                  </div>

                  {/* Manual Tags */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-medium text-foreground">Tags thủ công</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(selectedFileToView.tagsManual || []).length > 0 ? (
                        (selectedFileToView.tagsManual || []).map((tag, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {tag}
                            <button
                              onClick={() => {
                                const newTags = (selectedFileToView.tagsManual || []).filter((_, idx) => idx !== i);
                                updateFileMutation.mutate({ id: selectedFileToView.id, updates: { tagsManual: newTags } as any });
                                setSelectedFileToView({ ...selectedFileToView, tagsManual: newTags });
                              }}
                              className="hover:text-destructive ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Chưa có tags thủ công</span>
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Folder className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-medium text-foreground">Danh mục</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => {
                          updateFileMutation.mutate({ id: selectedFileToView.id, updates: { categoryId: null } as any });
                          setSelectedFileToView({ ...selectedFileToView, categoryId: null });
                        }}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                          selectedFileToView.categoryId === null
                            ? "border-muted-foreground bg-muted text-foreground font-medium"
                            : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        Không phân loại
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            updateFileMutation.mutate({ id: selectedFileToView.id, updates: { categoryId: cat.id } as any });
                            setSelectedFileToView({ ...selectedFileToView, categoryId: cat.id });
                          }}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                            selectedFileToView.categoryId === cat.id
                              ? "border-orange-400 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium"
                              : "border-border hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border/50 p-4 sm:p-6 flex gap-2 shrink-0 justify-end">
              <Button
                variant="outline"
                onClick={() => setSelectedFileToView(null)}
                data-testid="button-close-modal"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ===== KNOWLEDGE FILE ROW =====
function KnowledgeFileRow({
  file, categories, onView, onDelete, onAutoTag, onUpdateAiTags, onUpdateManualTags, onSetCategory, isDeleting, isAutoTagging
}: {
  file: KnowledgeFile;
  categories: KnowledgeCategory[];
  onView: () => void;
  onDelete: () => void;
  onAutoTag: () => void;
  onUpdateAiTags: (tags: string[]) => void;
  onUpdateManualTags: (tags: string[]) => void;
  onSetCategory: (categoryId: number | null) => void;
  isDeleting: boolean;
  isAutoTagging: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingManualTag, setAddingManualTag] = useState(false);
  const [newManualTag, setNewManualTag] = useState("");
  const [showCategorySelect, setShowCategorySelect] = useState(false);

  const aiTags = file.tags || [];
  const manualTags = file.tagsManual || [];
  const sourceMeta = SOURCE_LABELS[file.source] || { label: file.source, color: "bg-gray-100 text-gray-600" };
  const category = categories.find(c => c.id === file.categoryId);

  const handleAddManualTag = () => {
    const t = newManualTag.trim();
    if (t && !manualTags.includes(t)) {
      onUpdateManualTags([...manualTags, t]);
    }
    setNewManualTag("");
    setAddingManualTag(false);
  };

  return (
    <div className={`rounded-lg border ${file.pendingUpdate ? "border-amber-300/60 bg-amber-500/5" : "border-border/50"} transition-colors`} data-testid={`row-knowledge-file-${file.id}`}>
      {/* Main row */}
      <div className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onView}>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* File icon + name */}
        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium truncate max-w-[200px] sm:max-w-none">{file.originalName}</span>
            {/* Type badge */}
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-mono shrink-0">{file.fileType}</span>
            {/* Source badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${sourceMeta.color}`}>{sourceMeta.label}</span>
            {/* Pending badge */}
            {file.pendingUpdate ? (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 shrink-0">Chờ cập nhật</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</span>
            <span className="text-muted-foreground">·</span>
            {/* Category */}
            {category ? (
              <button
                onClick={() => setShowCategorySelect(!showCategorySelect)}
                className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-0.5 hover:underline"
                data-testid={`button-category-${file.id}`}
              >
                <Folder className="w-3 h-3" />{category.name}
              </button>
            ) : (
              <button
                onClick={() => setShowCategorySelect(!showCategorySelect)}
                className="text-xs text-muted-foreground hover:text-orange-500 flex items-center gap-0.5 transition-colors"
                data-testid={`button-assign-category-${file.id}`}
              >
                <Folder className="w-3 h-3" />Gán danh mục
              </button>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-3 h-3" />{formatRelative(file.lastUpdated)}
            </span>
            {/* Quick tags preview */}
            {!expanded && (aiTags.length > 0 || manualTags.length > 0) && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{aiTags.length + manualTags.length} tags</span>
              </>
            )}
          </div>

          {/* Category dropdown */}
          {showCategorySelect && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button
                onClick={() => { onSetCategory(null); setShowCategorySelect(false); }}
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors"
              >
                Bỏ danh mục
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { onSetCategory(cat.id); setShowCategorySelect(false); }}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${file.categoryId === cat.id ? "border-orange-400 bg-orange-500/10 text-orange-600" : "border-border hover:bg-muted"}`}
                  data-testid={`button-set-cat-${cat.id}-file-${file.id}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost" size="sm"
            onClick={onAutoTag}
            disabled={isAutoTagging}
            className="h-6 px-2 text-xs"
            data-testid={`button-autotag-${file.id}`}
          >
            {isAutoTagging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-purple-500" />}
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={onDelete}
            disabled={isDeleting}
            className="h-6 w-6"
            data-testid={`button-delete-file-${file.id}`}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Expanded: Tags */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/30 pt-2 space-y-2">
          {/* AI Tags */}
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" />AI Tags
            </p>
            <div className="flex flex-wrap gap-1">
              {aiTags.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  {tag}
                  <button onClick={() => onUpdateAiTags(aiTags.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {aiTags.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Chưa có AI tag</span>
              )}
            </div>
          </div>

          {/* Manual Tags */}
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-blue-400" />Tags thủ công
            </p>
            <div className="flex flex-wrap gap-1">
              {manualTags.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {tag}
                  <button onClick={() => onUpdateManualTags(manualTags.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {addingManualTag ? (
                <input
                  autoFocus
                  value={newManualTag}
                  onChange={(e) => setNewManualTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddManualTag(); if (e.key === "Escape") setAddingManualTag(false); }}
                  onBlur={() => { if (newManualTag.trim()) handleAddManualTag(); else setAddingManualTag(false); }}
                  className="w-20 text-xs border border-blue-300 rounded-full px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 bg-transparent"
                  placeholder="Tag..."
                  data-testid={`input-manual-tag-${file.id}`}
                />
              ) : (
                <button
                  onClick={() => setAddingManualTag(true)}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border border-dashed border-blue-300 text-blue-400 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  data-testid={`button-add-manual-tag-${file.id}`}
                >
                  <Plus className="w-2.5 h-2.5" />Tag
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
          <div className="bg-orange-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Google Drive link (https://drive.google.com/file/d/...)"
          value={driveLink}
          onChange={(e) => setDriveLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddDriveLink()}
          disabled={isLoading}
          className="text-sm"
          data-testid="input-drive-link"
        />
        <Button
          onClick={handleAddDriveLink}
          disabled={isLoading || !driveLink.trim()}
          className="gap-2 shrink-0"
          data-testid="button-add-drive-link"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
          Thêm
        </Button>
      </div>
      {driveFiles.length > 0 && (
        <p className="text-xs text-green-600 font-medium">AI đang học từ {driveFiles.length} file Drive</p>
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
    return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!templatesQuery.data || templatesQuery.data.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-xs">Chưa có mẫu nào trong Drive</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {templatesQuery.data.map((template: any) => (
        <div key={template.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-template-${template.id}`}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-xs truncate">{template.name}</span>
          </div>
          <Button
            variant={learned.includes(template.name) ? "default" : "ghost"}
            size="sm"
            onClick={() => handleLearn(template.name)}
            className="h-6 px-2 text-xs shrink-0"
            data-testid={`button-learn-template-${template.id}`}
          >
            {learned.includes(template.name) ? "Đã học" : "Học"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function StripeProducts() {
  const { toast } = useToast();

  const publishableKeyQuery = useQuery<{ publishableKey: string }>({
    queryKey: ["/api/stripe/publishable-key"],
  });

  const productsQuery = useQuery<any[]>({
    queryKey: ["/api/stripe/products"],
    enabled: !!publishableKeyQuery.data?.publishableKey,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { priceId });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: () => {
      toast({ title: "Lỗi", description: "Không thể tạo checkout session", variant: "destructive" });
    },
  });

  if (productsQuery.isLoading || publishableKeyQuery.isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!productsQuery.data || productsQuery.data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Chưa có gói dịch vụ nào</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {productsQuery.data.map((product: any) => {
        const price = product.default_price;
        const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
        const currency = price?.currency?.toUpperCase() || "USD";
        return (
          <div key={product.id} className="p-4 rounded-xl border border-border/50 hover:border-primary/40 transition-colors" data-testid={`card-product-${product.id}`}>
            <h3 className="font-semibold text-sm">{product.name}</h3>
            {product.description && <p className="text-xs text-muted-foreground mt-1">{product.description}</p>}
            <div className="mt-3 flex items-center justify-between">
              <span className="font-bold text-primary">
                {amount.toLocaleString()} {currency}
                {price?.recurring && <span className="text-xs font-normal text-muted-foreground">/{price.recurring.interval}</span>}
              </span>
              {price?.id && (
                <Button
                  size="sm"
                  onClick={() => checkoutMutation.mutate(price.id)}
                  disabled={checkoutMutation.isPending}
                  data-testid={`button-checkout-${product.id}`}
                >
                  {checkoutMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Mua ngay"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
