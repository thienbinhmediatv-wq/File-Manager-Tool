import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCreateProject } from "@/hooks/use-projects";
import { insertProjectSchema } from "@shared/schema";
import { Loader2, Sparkles } from "lucide-react";

const STYLES = ["Wabi Sabi", "Modern", "Minimalist", "Neoclassic", "Industrial", "Scandinavian"];

// Need to coerce string inputs to numbers for validation
const formSchema = insertProjectSchema.extend({
  landWidth: z.coerce.number().min(1, "Must be at least 1m"),
  landLength: z.coerce.number().min(1, "Must be at least 1m"),
  floors: z.coerce.number().min(1).max(10, "Max 10 floors supported currently"),
  bedrooms: z.coerce.number().min(1).max(20),
  budget: z.coerce.number().min(100, "Minimum budget 100M VND"),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: Props) {
  const createMutation = useCreateProject();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
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
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl glass p-0 overflow-hidden border-border/50">
        <div className="p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              New AI Project
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-base">
              Enter the land specifications and style preferences to start generating.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground font-semibold">Project Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Villa Sunrise" className="bg-white/50 border-slate-200 h-12 rounded-xl focus-visible:ring-primary/20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="landWidth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Width (m)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" className="bg-white/50 h-12 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="landLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Length (m)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" className="bg-white/50 h-12 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="floors"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Floors</FormLabel>
                      <FormControl>
                        <Input type="number" className="bg-white/50 h-12 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bedrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Bedrooms</FormLabel>
                      <FormControl>
                        <Input type="number" className="bg-white/50 h-12 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Design Style</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white/50 h-12 rounded-xl">
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl">
                          {STYLES.map(style => (
                            <SelectItem key={style} value={style}>{style}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground font-semibold">Budget (Mil VND)</FormLabel>
                      <FormControl>
                        <Input type="number" className="bg-white/50 h-12 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="outline" className="rounded-xl px-6" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  className="rounded-xl px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                  ) : "Create Project"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
