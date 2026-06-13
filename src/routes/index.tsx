import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { slugifyAddr } from "./objekt.$slug";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Översikt · Stendahl CRM" },
      { name: "description", content: "Översikt över omsättning, objekt och visningar." },
    ],
  }),
  component: DashboardPage,
});

const serifStyle = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif', letterSpacing: "-0.01em" } as const;

const kpis = [
  { label: "Omsättning i år", value: "42,8 Mkr", delta: "+18%", trend: "up" as const },
  { label: "Aktiva objekt", value: "7", delta: "+2 denna vecka", trend: "up" as const },
  { label: "Kommande visningar", value: "12", delta: "Nästa: lör 14:00", trend: "neutral" as const },
  { label: "Snittprovision", value: "182 tkr", delta: "−3%", trend: "down" as const },
];

const pipeline = [
  { stage: "Värdering", count: 4 },
  { stage: "Säljklart", count: 3 },
  { stage: "Till salu", count: 7 },
  { stage: "Budgivning", count: 2 },
  { stage: "Avslut", count: 5 },
];

const objekt = [
  { addr: "Södragården 9", area: "Långvik, Forsvik", pris: "4 975 000", status: "Till salu", visningar: 2 },
  { addr: "Stationsgatan 8B", area: "Centrum, Långvik", pris: "8 200 000", status: "Budgivning", visningar: 4 },
  { addr: "Tallbacken 3", area: "Stenkulla", pris: "3 450 000", status: "Värdering", visningar: 0 },
  { addr: "Granstigen 18", area: "Granvik", pris: "6 100 000", status: "Till salu", visningar: 3 },
];

const visningar = [
  { when: "Lör 14 jun · 14:00", addr: "Södragården 9", anmalda: 8 },
  { when: "Sön 15 jun · 11:30", addr: "Granstigen 18", anmalda: 5 },
  { when: "Mån 16 jun · 17:30", addr: "Stationsgatan 8B", anmalda: 12 },
];

function DashboardPage() {
  const maxCount = Math.max(...pipeline.map((p) => p.count));
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <section className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-primary/80">Översikt</div>
            <h1 className="text-4xl font-medium leading-tight md:text-5xl" style={serifStyle}>
              God morgon, Erik<span className="text-primary">.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Här är hur affären står just nu. Tre objekt behöver din uppmärksamhet idag.
            </p>
          </div>
          <Link to="/objekt/nytt"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]">
            <span className="text-base leading-none">+</span> Nytt objekt
          </Link>
        </section>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-white/[0.07] bg-card/60 p-5 backdrop-blur-sm shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{k.label}</div>
              <div className="mt-3 text-3xl font-medium text-foreground" style={serifStyle}>{k.value}</div>
              <div className={[
                "mt-2 text-xs",
                k.trend === "up" ? "text-primary" : k.trend === "down" ? "text-destructive" : "text-muted-foreground",
              ].join(" ")}>
                {k.delta}
              </div>
            </div>
          ))}
        </div>

        {/* Resizable workspace: drag horisontellt mellan pipeline/kalender, vertikalt mot objekttabellen */}
        <ResizablePanelGroup
          orientation="vertical"
          className="min-h-[720px] rounded-xl"
        >
          <ResizablePanel defaultSize={45} minSize={20}>
            <ResizablePanelGroup
              orientation="horizontal"
              className="h-full gap-0"
            >
              <ResizablePanel defaultSize={58} minSize={25}>
                <Card className="h-full overflow-auto">
                  <Title eyebrow="Pipeline" title="Objektsflöde" />
                  <div className="mt-4 space-y-3">
                    {pipeline.map((p) => (
                      <div key={p.stage}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{p.stage}</span>
                          <span className="font-mono text-foreground">{p.count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
                            style={{ width: `${(p.count / maxCount) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </ResizablePanel>
              <ResizableHandle withHandle orientation="horizontal" className="mx-2 bg-transparent" />
              <ResizablePanel defaultSize={42} minSize={25}>
                <Card className="h-full overflow-auto">
                  <Title eyebrow="Kalender" title="Kommande visningar" />
                  <div className="mt-4 space-y-3">
                    {visningar.map((v) => (
                      <div key={v.addr + v.when} className="flex items-start justify-between gap-3 rounded-md border border-border bg-foreground/[0.02] p-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-primary/80">{v.when}</div>
                          <div className="mt-1 text-sm text-foreground">{v.addr}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-lg text-foreground" style={serifStyle}>{v.anmalda}</div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">anmälda</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle orientation="vertical" className="my-2 bg-transparent" />

          <ResizablePanel defaultSize={55} minSize={15}>
            <Card className="flex h-full flex-col overflow-hidden">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Title eyebrow="Portfölj" title="Aktiva objekt" />
                <Link to="/objekt/nytt" className="text-xs uppercase tracking-[0.16em] text-primary hover:text-primary/80">
                  + Lägg till →
                </Link>
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <th className="pb-3 pr-4 font-normal">Adress</th>
                      <th className="pb-3 pr-4 font-normal">Område</th>
                      <th className="pb-3 pr-4 font-normal">Utgångspris</th>
                      <th className="pb-3 pr-4 font-normal">Status</th>
                      <th className="pb-3 text-right font-normal">Visningar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objekt.map((o) => (
                      <tr key={o.addr} className="border-t border-border">
                        <td className="py-3 pr-4 font-medium text-foreground">
                          <Link
                            to="/objekt/$slug"
                            params={{ slug: slugifyAddr(o.addr) }}
                            className="hover:text-primary"
                          >
                            {o.addr}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{o.area}</td>
                        <td className="py-3 pr-4 font-mono">{o.pris}</td>
                        <td className="py-3 pr-4">
                          <span className={[
                            "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                            o.status === "Budgivning" ? "border-primary/40 bg-primary/10 text-primary"
                              : o.status === "Till salu" ? "border-border bg-foreground/[0.04] text-foreground"
                              : "border-border bg-foreground/[0.02] text-muted-foreground",
                          ].join(" ")}>{o.status}</span>
                        </td>
                        <td className="py-3 text-right font-mono text-foreground">{o.visningar}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Legacy block (replaced by resizable workspace above) */}
        {false && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <Title eyebrow="Pipeline" title="Objektsflöde" />
            <div className="mt-4 space-y-3">
              {pipeline.map((p) => (
                <div key={p.stage}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{p.stage}</span>
                    <span className="font-mono text-foreground">{p.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
                      style={{ width: `${(p.count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Visningar */}
          <Card>
            <Title eyebrow="Kalender" title="Kommande visningar" />
            <div className="mt-4 space-y-3">
              {visningar.map((v) => (
                <div key={v.addr + v.when} className="flex items-start justify-between gap-3 rounded-md border border-white/[0.05] bg-white/[0.015] p-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-primary/80">{v.when}</div>
                    <div className="mt-1 text-sm text-foreground">{v.addr}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg text-foreground" style={serifStyle}>{v.anmalda}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">anmälda</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        )}

        {false && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Title eyebrow="Portfölj" title="Aktiva objekt" />
            <Link to="/objekt/nytt" className="text-xs uppercase tracking-[0.16em] text-primary hover:text-primary/80">
              + Lägg till →
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="pb-3 pr-4 font-normal">Adress</th>
                  <th className="pb-3 pr-4 font-normal">Område</th>
                  <th className="pb-3 pr-4 font-normal">Utgångspris</th>
                  <th className="pb-3 pr-4 font-normal">Status</th>
                  <th className="pb-3 text-right font-normal">Visningar</th>
                </tr>
              </thead>
              <tbody>
                {objekt.map((o) => (
                  <tr key={o.addr} className="border-t border-white/[0.05]">
                    <td className="py-3 pr-4 font-medium text-foreground">{o.addr}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{o.area}</td>
                    <td className="py-3 pr-4 font-mono">{o.pris}</td>
                    <td className="py-3 pr-4">
                      <span className={[
                        "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                        o.status === "Budgivning" ? "border-primary/40 bg-primary/10 text-primary"
                          : o.status === "Till salu" ? "border-white/15 bg-white/[0.04] text-foreground"
                          : "border-white/10 bg-white/[0.02] text-muted-foreground",
                      ].join(" ")}>{o.status}</span>
                    </td>
                    <td className="py-3 text-right font-mono text-foreground">{o.visningar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        )}
      </div>
    </AppShell>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/[0.07] bg-card/60 p-6 backdrop-blur-sm shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] ${className}`}>
      {children}
    </section>
  );
}

function Title({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-primary/70">{eyebrow}</div>
      <h2 className="mt-1 text-lg font-medium" style={serifStyle}>{title}</h2>
    </div>
  );
}