import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import ProjectWizard from "@/pages/ProjectWizard";
import Settings from "@/pages/Settings";
import Guide from "@/pages/Guide";
import { ThemeProvider } from "@/contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={Dashboard} />
      <Route path="/projects/:id" component={ProjectWizard} />
      <Route path="/settings" component={Settings} />
      <Route path="/guide" component={Guide} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
