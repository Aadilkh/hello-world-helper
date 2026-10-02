import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Cpu, Loader2, ShieldCheck, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { listCapabilities, runAutonomousDevelopment, toggleCapability } from "@/lib/upgrade.functions";
import type { UpgradeResult } from "@/lib/upgrade.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/engine")({
  head: () => ({
    meta: [
      { title: "Self-Upgrade Engine — Vision Pilot" },
      { name: "description", content: "Vision Pilot ki salahiyatein: kami pehchaan, research, nayi salahiyat aur registry." },
      { property: "og:title", content: "Self-Upgrade Engine — Vision Pilot" },
      { property: "og:description", content: "Kami pehchaan kar khud nayi salahiyat banane wala engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EnginePage,
});

function EnginePage() {
  const qc = useQueryClient();
  const [req, setReq] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UpgradeResult | null>(null);
  const capsQ = useQuery({ queryKey: ["capabilities"], queryFn: () => listCapabilities() });

  async function run() {
    if (req.trim().length < 5) return void toast.error("Zaroorat likhein");
    setBusy(true);
    setResult(null);
    try {
      const r = await runAutonomousDevelopment({ data: { requirement: req.trim() } });
      setResult(r);
      qc.invalidateQueries({ queryKey: ["capabilities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Engine nahi chala");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await toggleCapability({ data: { id, active } });
      qc.invalidateQueries({ queryKey: ["capabilities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Badal nahi saka");
    }
  }

  const caps = capsQ.data?.capabilities ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <Link to="/" aria-label="Wapas" className="rounded-lg p-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Cpu className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-bold">Self-Upgrade Engine</span>
        </div>
      </header>
      <main className="mx-auto max-w-md space-y-4 px-4 pb-24 pt-5">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Nayi salahiyat chahiye?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Engine check karega kya pehle se maujood hai. Agar kami hai to research karke nayi salahiyat banayega,
            jaanchega aur registry mein daalega. Core salahiyatein mehfooz rehti hain.
          </p>
          <Textarea
            value={req}
            onChange={(e) => setReq(e.target.value)}
            placeholder="Misal: Japanese audience ke liye coding course videos ka sahi andaz"
            className="mt-3 min-h-[80px]"
          />
          <Button className="mt-3 w-full gap-2" disabled={busy} onClick={run}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
            {busy ? "Engine chal raha hai… (1-2 minute)" : "Engine chalao"}
          </Button>
        </div>

        {result ? (
          <div className="rounded-2xl border border-primary/40 bg-card p-4 text-sm">
            <p className="font-semibold">
              {result.status === "AUTONOMOUS_DEVELOPMENT_PASS"
                ? "Nayi salahiyat ban gayi ✓"
                : result.status === "ALREADY_CAPABLE"
                  ? "Ye salahiyat pehle se maujood hai"
                  : "Nayi salahiyat pass nahi hui"}
            </p>
            <ul className="mt-3 space-y-2">
              {result.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  {s.status === "PASS" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  ) : s.status === "FAIL" ? (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span>
                    <b>{s.step}:</b> <span className="text-muted-foreground">{s.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-semibold">Registry ({caps.length})</p>
          {capsQ.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {capsQ.error ? <p className="text-xs text-destructive">Registry load nahi hui</p> : null}
          <div className="space-y-2">
            {caps.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{c.name}</span>
                  {c.is_core ? (
                    <span className="flex items-center gap-1 text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" /> Core
                    </span>
                  ) : (
                    <button
                      onClick={() => toggle(c.id, c.status !== "ACTIVE")}
                      className={`rounded-full border px-2 py-0.5 ${c.status === "ACTIVE" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {c.status === "ACTIVE" ? "Active" : "Band"}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-muted-foreground">{c.description}</p>
                {c.sha256 ? <p className="mt-1 font-mono text-[10px] text-muted-foreground">SHA-256 {c.sha256.slice(0, 16)}…</p> : null}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
