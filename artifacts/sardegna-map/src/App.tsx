import { lazy, Suspense, useState, useEffect } from "react";
import { Switch, Route, Link, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import NotFound from "@/pages/not-found";
import { Home } from "./pages/home";
import { Stats } from "./pages/stats";
import { FestivalPage } from "./pages/festival";
import { Map, BarChart2, Sun, Moon } from "lucide-react";

// Lazy-loaded — Vite creates a separate chunk, excluded from the public bundle
const Admin = lazy(() => import("./pages/admin").then((m) => ({ default: m.Admin })));

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem("sardegna_theme") === "dark" ||
      (!localStorage.getItem("sardegna_theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("sardegna_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("sardegna_theme", "light");
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif italic text-xl">S</div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">Sardegna Eventi</h1>
          </Link>
          <nav className="flex items-center gap-3">
            <button
              onClick={() => {
                if (location !== "/" && !location.startsWith("/eventi/")) {
                  setLocation("/");
                } else {
                  window.dispatchEvent(new CustomEvent("toggle-map-view"));
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors cursor-pointer bg-transparent border-none text-foreground"
            >
              <Map className="w-4 h-4 text-primary" /> Mappa
            </button>
            <Link href="/stats" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors text-foreground">
              <BarChart2 className="w-4 h-4 text-secondary" /> Statistiche
            </Link>
            <button
              onClick={() => setIsDark(!isDark)}
              title={isDark ? "Passa a Tema Chiaro" : "Passa a Tema Scuro"}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors cursor-pointer bg-transparent border border-border text-foreground ml-1"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" /> <span className="hidden sm:inline">Chiaro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-500" /> <span className="hidden sm:inline">Scuro</span>
                </>
              )}
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Admin route — no Layout wrapper, no menu link, lazy chunk */}
      <Route path="/admin-panel">
        <Suspense fallback={null}>
          <Admin />
        </Suspense>
      </Route>

      {/* Public routes */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/eventi/:idAndSlug" component={Home} />
            <Route path="/stats" component={Stats} />
            <Route path="/festival/:id" component={FestivalPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;