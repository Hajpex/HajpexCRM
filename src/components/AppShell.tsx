import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { GlobalSearchTrigger } from "./CommandPalette";

type Item = { to: string; label: string; icon: ReactNode };

const ITEMS: Item[] = [
  { to: "/", label: "Översikt", icon: <DashboardIcon /> },
  { to: "/objekt/nytt", label: "Nytt objekt", icon: <PlusIcon /> },
  { to: "/objekt", label: "Objekt", icon: <ListIcon /> },
  { to: "/listor", label: "Listor", icon: <LayersIcon /> },
  { to: "/kunder", label: "Kunder", icon: <UsersIcon /> },
  { to: "/visningar", label: "Visningar", icon: <CalendarIcon /> },
  { to: "/statistik", label: "Statistik", icon: <ChartIcon /> },
];

const fontStyle = { fontFamily: '"Work Sans", system-ui, sans-serif' } as const;

const serifLogo = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' } as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen w-full bg-background text-foreground" style={fontStyle}>
      <BackgroundGlow />
      {/* Top search bar */}
      <div className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center px-4 py-2.5 md:max-w-2xl">
          <GlobalSearchTrigger />
        </div>
      </div>
      <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)]">
        <aside className="sticky top-[3.35rem] hidden h-[calc(100vh-3.35rem)] w-56 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-sm md:flex">
          {/* Logo */}
          <div className="px-5 py-6">
            <div className="flex items-baseline gap-1" style={serifLogo}>
              <span className="text-xl font-medium tracking-tight text-foreground">Hajpex</span>
              <span className="text-xl text-primary">·</span>
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">CRM</div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5 px-3">
            {ITEMS.map((it) => {
              const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={[
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                  ].join(" ")}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <span className={active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}>
                    {it.icon}
                  </span>
                  <span className={active ? "font-medium" : ""}>{it.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="mt-auto border-t border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary">
                EL
              </div>
              <div>
                <div className="text-xs font-medium text-foreground">Erik Lindqvist</div>
                <div className="text-[10px] text-muted-foreground">Mäklare</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -top-60 left-1/4 h-[700px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.18]"
        style={{ background: "radial-gradient(closest-side, oklch(0.72 0.12 80), transparent)" }} />
      <div className="absolute -bottom-20 right-0 h-[600px] w-[600px] opacity-[0.10]"
        style={{ background: "radial-gradient(closest-side, oklch(0.72 0.12 80), transparent)" }} />
    </div>
  );
}

function DashboardIcon() { return <Svg><path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/></Svg>; }
function PlusIcon() { return <Svg><path d="M12 5v14M5 12h14"/></Svg>; }
function ListIcon() { return <Svg><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></Svg>; }
function UsersIcon() { return <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Svg>; }
function CalendarIcon() { return <Svg><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Svg>; }
function ChartIcon() { return <Svg><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-6"/></Svg>; }
function LayersIcon() { return <Svg><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></Svg>; }

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}