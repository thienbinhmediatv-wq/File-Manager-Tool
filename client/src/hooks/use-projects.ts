import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
}

export function useProject(id: number) {
  return useQuery<Project>({
    queryKey: ["/api/projects", id],
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as Project | undefined;
      if (!data) return false;
      const statuses = (data.stepStatuses || {}) as Record<string, string>;
      const isProcessing = Object.values(statuses).some(s => s === "processing");
      return isProcessing ? 3000 : false;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Thành công", description: "Dự án đã được tạo." });
    },
    onError: (error: Error) => {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Đã xoá", description: "Dự án đã được xoá." });
    },
    onError: (error: Error) => {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    },
  });
}

export function useSubmitStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, step, data }: { projectId: number; step: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/step/${step}/submit`, data);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", vars.projectId] });
    },
  });
}

export function useProcessStep() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ projectId, step }: { projectId: number; step: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/step/${step}/process`);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", vars.projectId] });
      toast({ title: "Hoàn thành", description: "AI đã xử lý xong bước này." });
    },
    onError: (error: Error) => {
      toast({ title: "Lỗi xử lý", description: error.message, variant: "destructive" });
    },
  });
}

export function useApproveStep() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ projectId, step }: { projectId: number; step: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/step/${step}/approve`);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Đã duyệt", description: "Chuyển sang bước tiếp theo." });
    },
  });
}

export function useRedoStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, step }: { projectId: number; step: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/step/${step}/redo`);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", vars.projectId] });
    },
  });
}
