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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen w-full bg-background text-foreground" style={fontStyle}>
      <BackgroundGlow />
      {/* Top centered search bar — always visible */}
      <div className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center px-4 py-2.5 md:max-w-2xl">
          <GlobalSearchTrigger />
        </div>
      </div>
      <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)]">
        <aside className="sticky top-0 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col border-r border-border bg-card/80 backdrop-blur-sm md:flex">
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
              <span className="font-semibold tracking-wider">S</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-medium">Stendahl <span className="text-primary">·</span> CRM</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Erik Lindqvist</div>
            </div>
          </div>
          <nav className="mt-2 flex flex-col gap-1 px-3">
            {ITEMS.map((it) => {
              const active = pathname === it.to;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={[
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                  ].join(" ")}
                >
                  <span className={active ? "text-background" : "text-muted-foreground group-hover:text-foreground"}>
                    {it.icon}
                  </span>
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto px-5 py-5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            v0.2 · prototyp
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
      <div className="absolute -top-40 left-1/3 h-[600px] w-[800px] -translate-x-1/2 rounded-full opacity-[0.35]"
        style={{ background: "radial-gradient(closest-side, oklch(0.72 0.12 80 / 0.25), transparent)" }} />
      <div className="absolute bottom-0 right-0 h-[500px] w-[500px] opacity-[0.25]"
        style={{ background: "radial-gradient(closest-side, oklch(0.85 0.04 90 / 0.6), transparent)" }} />
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