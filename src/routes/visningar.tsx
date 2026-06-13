import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";

export const Route = createFileRoute("/visningar")({
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 pt-16">
        <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-primary/80">Visningar</div>
        <h1 className="text-4xl font-medium md:text-5xl" style={{ fontFamily: '"Instrument Serif", serif', letterSpacing: "-0.01em" }}>
          Snart här<span className="text-primary">.</span>
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">Kalender, anmälningar och påminnelser.</p>
        <Link to="/" className="mt-6 inline-block text-xs uppercase tracking-[0.16em] text-primary">← Tillbaka</Link>
      </div>
    </AppShell>
  ),
});