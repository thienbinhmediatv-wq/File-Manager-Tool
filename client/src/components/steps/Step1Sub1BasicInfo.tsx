import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const FLOOR_OPTIONS = [
  { value: 1, label: "1 Tầng" },
  { value: 2, label: "2 Tầng" },
  { value: 3, label: "3 Tầng" },
  { value: 5, label: "4-5 Tầng" },
];

const formSchema = z.object({
  projectType: z.enum(["Xây mới", "Sửa chữa"]),
  title: z.string().min(1, "Nhập tên dự án"),
  clientName: z.string().default(""),
  landWidth: z.coerce.number().min(1, "Tối thiểu 1m"),
  landLength: z.coerce.number().min(1, "Tối thiểu 1m"),
  floors: z.coerce.number().min(1),
  bedrooms: z.coerce.number().min(1).max(20),
  bathrooms: z.coerce.number().min(1).max(20),
  budget: z.coerce.number().min(0, "Nhập ngân sách"),
  style: z.string().default("Modern"),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  onSubmit: (data: FormValues) => void;
  isPending: boolean;
  existingProject?: import("@shared/schema").Project | null;
}

export function Step1Sub1BasicInfo({ onSubmit, isPending, existingProject }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectType: (existingProject?.projectType as "Xây mới" | "Sửa chữa") || "Xây mới",
      title: existingProject?.title || "",
      clientName: existingProject?.clientName || "",
      landWidth: existingProject?.landWidth || 5,
      landLength: existingProject?.landLength || 20,
      floors: existingProject?.floors || 2,
      bedrooms: existingProject?.bedrooms || 3,
      bathrooms: existingProject?.bathrooms || 2,
      budget: existingProject?.budget || 1500,
      style: existingProject?.style || "Modern",
    },
  });

  const selectedFloors = form.watch("floors");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1" data-testid="text-sub1-title">Thông tin cơ bản</h3>
        <p className="text-sm text-muted-foreground">Nhập thông tin dự án để bắt đầu thiết kế.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField control={form.control} name="projectType" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Loại dự án</FormLabel>
              <div className="flex gap-3">
                {["Xây mới", "Sửa chữa"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => field.onChange(type)}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all",
                      field.value === type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground"
                    )}
                    data-testid={`radio-project-type-${type}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )} />

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

          <FormField control={form.control} name="floors" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold">Số tầng</FormLabel>
              <div className="grid grid-cols-4 gap-3">
                {FLOOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      "py-3 px-2 rounded-xl border-2 text-sm font-semibold transition-all",
                      selectedFloors === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground"
                    )}
                    data-testid={`button-floors-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="bedrooms" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Phòng ngủ</FormLabel>
                <FormControl><Input type="number" className="h-11 rounded-xl" {...field} data-testid="input-bedrooms" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="bathrooms" render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold">Phòng WC</FormLabel>
                <FormControl><Input type="number" className="h-11 rounded-xl" {...field} data-testid="input-bathrooms" /></FormControl>
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

          <div className="pt-3 flex justify-end">
            <Button
              type="submit"
              disabled={isPending}
              className="rounded-xl px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25"
              data-testid="button-submit-basic-info"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang tạo...</>
              ) : "Tiếp tục →"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
