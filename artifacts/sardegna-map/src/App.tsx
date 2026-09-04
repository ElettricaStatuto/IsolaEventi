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
import { CalendarPage } from "./pages/calendar";
import { Map, BarChart2, CalendarDays, Sun, Moon, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorBoundary } from "./components/error-boundary";

// Lazy-loaded — Vite creates a separate chunk, excluded from the public bundle
const Admin = lazy(() => import("./pages/admin").then((m) => ({ default: m.Admin })));

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem("sardegna_theme") === "dark" ||
      (!localStorage.getItem("sardegna_theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCalendarPage = location === "/calendario";
  const handleToggleMappa = () => {
    if (location !== "/" && !location.startsWith("/eventi/")) {
      setLocation("/");
    } else {
      window.dispatchEvent(new CustomEvent("toggle-map-view"));
    }
  };

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
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif italic text-xl shrink-0">S</div>
            <h1 className="font-serif text-lg sm:text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">Sardegna Eventi</h1>
          </Link>

          {/* Nav completa: solo da tablet in su, tutte le voci con testo */}
          <nav className="hidden md:flex items-center gap-3">
            <button
              onClick={handleToggleMappa}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors cursor-pointer bg-transparent border-none text-foreground"
            >
              <Map className="w-4 h-4 text-primary" /> Mappa
            </button>
            <Link href="/calendario" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors text-foreground">
              <CalendarDays className="w-4 h-4 text-secondary" /> Calendario
            </Link>
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

          {/* Nav mobile: scorciatoia rapida (Mappa<->Calendario) sempre visibile + menu ☰ per il resto */}
          <div className="flex md:hidden items-center gap-1 shrink-0">
            {isCalendarPage ? (
              <button
                onClick={handleToggleMappa}
                title="Vai alla Mappa"
                className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-muted cursor-pointer bg-transparent border-none text-foreground"
              >
                <Map className="w-5 h-5 text-primary" />
              </button>
            ) : (
              <Link
                href="/calendario"
                title="Vai al Calendario"
                className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-muted text-foreground"
              >
                <CalendarDays className="w-5 h-5 text-secondary" />
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(true)}
              title="Menu"
              className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-muted cursor-pointer bg-transparent border-none text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile a comparsa (☰): tutte le voci, con testo */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-3/4 sm:max-w-xs flex flex-col gap-1 pt-12">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <button
            onClick={() => {
              handleToggleMappa();
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted text-base font-medium transition-colors cursor-pointer bg-transparent border-none text-foreground text-left"
          >
            <Map className="w-5 h-5 text-primary" /> Mappa
          </button>
          <Link
            href="/calendario"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted text-base font-medium transition-colors text-foreground"
          >
            <CalendarDays className="w-5 h-5 text-secondary" /> Calendario
          </Link>
          <Link
            href="/stats"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted text-base font-medium transition-colors text-foreground"
          >
            <BarChart2 className="w-5 h-5 text-secondary" /> Statistiche
          </Link>
          <button
            onClick={() => {
              setIsDark(!isDark);
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted text-base font-medium transition-colors cursor-pointer bg-transparent border-none text-foreground text-left"
          >
            {isDark ? (
              <>
                <Sun className="w-5 h-5 text-amber-400" /> Tema Chiaro
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-indigo-500" /> Tema Scuro
              </>
            )}
          </button>
        </SheetContent>
      </Sheet>

      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <ErrorBoundary>{children}</ErrorBoundary>
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
            <Route path="/calendario" component={CalendarPage} />
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