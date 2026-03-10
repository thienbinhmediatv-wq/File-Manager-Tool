import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderKanban, Settings, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import logoImg from "@assets/logo_nobg.png";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Dự án", icon: FolderKanban, href: "/projects" },
    { label: "Cài đặt", icon: Settings, href: "/settings" },
  ];

  return (
    <div className="min-h-screen flex bg-background" data-testid="app-layout">
      <aside className="w-72 fixed inset-y-0 left-0 z-50 glass border-r border-border/50 hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <img src={logoImg} alt="BMT Decor" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-brand-name">
              BMT Decor
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight">AI Kiến trúc & Nội thất</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "text-primary bg-primary/10 shadow-sm"
                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                )}
                data-testid={`link-nav-${item.label.toLowerCase()}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-r-full" />
                )}
                <item.icon className={cn("w-5 h-5 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-border/50">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="BMT Decor" className="w-9 h-9 object-contain" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">CÔNG TY TNHH TMDV</p>
              <p className="text-xs text-muted-foreground">BMT DECOR</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-72 flex flex-col min-h-screen">
        <header className="h-16 glass z-40 sticky top-0 px-8 flex items-center justify-between border-b border-border/50">
          <h2 className="text-lg font-semibold text-foreground capitalize hidden sm:block">
            {location === "/" ? "Dashboard" : location.startsWith("/projects/") ? "Wizard thiết kế" : "Dự án"}
          </h2>
          <div className="flex items-center gap-4 ml-auto">
            <button className="p-2 rounded-full hover:bg-slate-100 text-muted-foreground transition-colors relative" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-white" />
            </button>
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
