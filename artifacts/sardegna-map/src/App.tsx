import { lazy, Suspense } from "react";
import { Switch, Route, Link, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Home } from "./pages/home";
import { Stats } from "./pages/stats";
import { FestivalPage } from "./pages/festival";
import { Map, BarChart2 } from "lucide-react";

// Lazy-loaded — Vite creates a separate chunk, excluded from the public bundle
const Admin = lazy(() => import("./pages/admin").then((m) => ({ default: m.Admin })));

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif italic text-xl">S</div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">Sardegna Eventi</h1>
          </Link>
          <nav className="flex gap-4">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("toggle-map-view"))}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors cursor-pointer bg-transparent border-none"
            >
              <Map className="w-4 h-4 text-primary" /> Mappa
            </button>
            <Link href="/stats" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors">
              <BarChart2 className="w-4 h-4 text-secondary" /> Statistiche
            </Link>
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
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;