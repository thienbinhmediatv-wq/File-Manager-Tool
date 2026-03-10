import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Database, Ruler, Box, Cuboid, Palette, Image as ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "input", label: "Input Data", icon: Database },
  { id: "planning", label: "Space Planning", icon: Ruler },
  { id: "cad", label: "CAD Generator", icon: Box },
  { id: "model", label: "3D Model", icon: Cuboid },
  { id: "interior", label: "Interior Design", icon: Palette },
  { id: "render", label: "Render", icon: ImageIcon },
  { id: "pdf", label: "Export PDF", icon: FileText },
];

interface Props {
  status: string; // "pending", "processing", "completed", "failed"
}

export function PipelineStepper({ status }: Props) {
  // We mock the progression visually if it's 'processing'
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    if (status === "completed") {
      setActiveStepIndex(STEPS.length);
      return;
    }
    if (status === "pending" || status === "failed") {
      setActiveStepIndex(0);
      return;
    }

    // Mock progress if processing
    if (status === "processing") {
      setActiveStepIndex(1); // Start at step 1
      const interval = setInterval(() => {
        setActiveStepIndex(prev => {
          if (prev < STEPS.length - 1) return prev + 1;
          return prev;
        });
      }, 3000); // advance every 3s
      return () => clearInterval(interval);
    }
  }, [status]);

  return (
    <div className="w-full py-8">
      <div className="relative flex justify-between">
        {/* Background Track */}
        <div className="absolute top-6 left-6 right-6 h-1 bg-slate-200 rounded-full" />
        
        {/* Active Track */}
        <motion.div 
          className="absolute top-6 left-6 h-1 bg-gradient-to-r from-primary to-accent rounded-full z-0"
          initial={{ width: "0%" }}
          animate={{ 
            width: `${Math.min(100, Math.max(0, (activeStepIndex / (STEPS.length - 1)) * 100))}%` 
          }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />

        {STEPS.map((step, index) => {
          const isCompleted = index < activeStepIndex || status === "completed";
          const isCurrent = index === activeStepIndex && status === "processing";

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isCompleted ? "hsl(var(--primary))" : isCurrent ? "hsl(var(--card))" : "hsl(var(--muted))",
                  borderColor: isCompleted || isCurrent ? "hsl(var(--primary))" : "hsl(var(--border))",
                  color: isCompleted ? "white" : isCurrent ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
                }}
                className={cn(
                  "w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-sm transition-colors duration-300",
                  isCurrent && "shadow-lg shadow-primary/30 ring-4 ring-primary/10"
                )}
              >
                {isCompleted ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <Check className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <step.icon className={cn("w-5 h-5", isCurrent && "animate-pulse")} />
                )}
              </motion.div>
              
              <div className="text-center w-24">
                <p className={cn(
                  "text-xs font-semibold mt-1 transition-colors duration-300",
                  isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.label}
                </p>
                {isCurrent && (
                  <motion.p 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="text-[10px] text-primary font-medium"
                  >
                    Processing...
                  </motion.p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
