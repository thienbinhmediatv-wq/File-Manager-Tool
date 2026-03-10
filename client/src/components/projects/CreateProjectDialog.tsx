import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCreateProject } from "@/hooks/use-projects";
import { Loader2, Building2 } from "lucide-react";

const STYLES = ["Modern", "Minimalist", "Wabi Sabi", "Neoclassic", "Industrial", "Scandinavian", "Indochine", "Tropical"];

const formSchema = z.object({
  title: z.string().min(1, "Nhập tên dự án"),
  clientName: z.string().default(""),
  landWidth: z.coerce.number().min(1, "Tối thiểu 1m"),
  landLength: z.coerce.number().min(1, "Tối thiểu 1m"),
  floors: z.coerce.number().min(1).max(10, "Tối đa 10 tầng"),
  bedrooms: z.coerce.number().min(1).max(20),
  style: z.string().min(1, "Chọn phong cách"),
  budget: z.coerce.number().min(0, "Nhập ngân sách"),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: Props) {
  const createMutation = useCreateProject();
  const [, setLocation] = useLocation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      clientName: "",
      landWidth: 5,
      landLength: 20,
      floors: 2,
      bedrooms: 3,
      style: "Modern",
      budget: 1500,
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data, {
      onSuccess: (project: { id: number }) => {
        onOpenChange(false);
        form.reset();
        setLocation(`/projects/${project.id}`);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl glass p-0 overflow-hidden border-border/50">
        <div className="p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Tạo dự án mới
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-base">
              Nhập thông tin cơ bản để bắt đầu wizard thiết kế 7 bước.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Tên dự án</FormLabel>
                    <FormControl><Input placeholder="VD: Biệt thự Anh Tùng" className="h-11 rounded-xl" {...field} data-testid="input-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Khách hàng</FormLabel>
                    <FormControl><Input placeholder="VD: Anh Tùng" className="h-11 rounded-xl" {...field} data-testid="input-client" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="landWidth" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Chiều rộng (m)</FormLabel>
                    <FormControl><Input type="number" step="0.1" className="h-11 rounded-xl" {...field} data-testid="input-width" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="landLength" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Chiều dài (m)</FormLabel>
                    <FormControl><Input type="number" step="0.1" className="h-11 rounded-xl" {...field} data-testid="input-length" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="floors" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Số tầng</FormLabel>
                    <FormControl><Input type="number" className="h-11 rounded-xl" {...field} data-testid="input-floors" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="bedrooms" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Phòng ngủ</FormLabel>
                    <FormControl><Input type="number" className="h-11 rounded-xl" {...field} data-testid="input-bedrooms" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="budget" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Ngân sách (Tr)</FormLabel>
                    <FormControl><Input type="number" className="h-11 rounded-xl" {...field} data-testid="input-budget" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="style" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">Phong cách thiết kế</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 rounded-xl" data-testid="select-style">
                        <SelectValue placeholder="Chọn phong cách" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl">
                      {STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="pt-3 flex justify-end gap-3">
                <Button type="button" variant="outline" className="rounded-xl px-6" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                  Huỷ
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-xl px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25"
                  data-testid="button-submit-create"
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang tạo...</>
                  ) : "Tạo dự án"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
