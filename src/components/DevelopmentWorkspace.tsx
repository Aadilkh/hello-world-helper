import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Code2,
  Download,
  FolderOpen,
  Loader2,
  Plus,
  Server,
  Smartphone,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeCodeStructure,
  packageApk,
  listVirtualServers,
  addVirtualServer,
  connectVirtualServer,
  deleteVirtualServer,
} from "@/lib/workspace.functions";
import type { CodeAnalysis, VirtualServer } from "@/lib/workspace.functions";
import { BuildPreview } from "@/components/BuildPreview";
import type { BuildResult } from "@/lib/upgrade.functions";

type DevTab = "overview" | "analysis" | "servers" | "apk";

export function DevelopmentWorkspace({
  lastBuild,
  onBack,
}: {
  lastBuild: BuildResult | null;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<DevTab>("overview");

  const tabs: Array<{ id: DevTab; label: string; icon: typeof Code2 }> = [
    { id: "overview", label: "Overview", icon: Code2 },
    { id: "analysis", label: "Code Analysis", icon: FolderOpen },
    { id: "servers", label: "Virtual Servers", icon: Server },
    { id: "apk", label: "APK / PWA", icon: Smartphone },
  ];

  return (
    <div className="vp-content-wrap">
      <div className="vp-page-heading vp-inner-title">
        <div>
          <button className="vp-back-button" onClick={onBack}>← Studio</button>
          <p className="vp-kicker">Build · Analyze · Deploy</p>
          <h1>Development workspace</h1>
          <p className="vp-subtitle">Code structure analysis, virtual server connection, aur APK/PWA packaging.</p>
        </div>
      </div>

      <div className="vp-dev-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "is-active" : ""}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab lastBuild={lastBuild} onBack={onBack} />}
      {tab === "analysis" && <AnalysisTab lastBuild={lastBuild} />}
      {tab === "servers" && <ServersTab />}
      {tab === "apk" && <ApkTab lastBuild={lastBuild} />}
    </div>
  );
}

function OverviewTab({ lastBuild, onBack }: { lastBuild: BuildResult | null; onBack: () => void }) {
  const checks = [
    "Idea ko research aur plan mein badalna",
    "React website, AI app ya game ka live preview",
    "Code structure analysis — architecture, strengths, weaknesses",
    "Virtual server connection for deployment",
    "APK/PWA packaging for mobile install",
    "Downloadable project output",
  ];
  return (
    <div className="vp-dev-section">
      <section className="vp-development-card">
        <div className="vp-development-heading">
          <span className="vp-development-icon"><Code2 size={24} /></span>
          <div>
            <p className="vp-kicker">Development option</p>
            <h2>Apna project banayein</h2>
            <p>Chat Box mein seedha command dein. Vision Pilot research karega, Dev Master build karega, aur live preview yahin dikhayega.</p>
          </div>
        </div>
        <div className="vp-development-grid">
          <div className="vp-development-checks">
            {checks.map((item) => (
              <div key={item}><span><Check size={14} /></span><p>{item}</p></div>
            ))}
          </div>
          <div className="vp-development-launch">
            <span className="vp-live-dot" />
            <b>Build system ready</b>
            <p>Website, game ya AI app ke liye workspace kholen.</p>
            <button className="vp-primary-button" onClick={onBack}>Start building <ArrowUpRight size={15} /></button>
          </div>
        </div>
      </section>

      {lastBuild ? (
        <div className="vp-dev-last-build">
          <p className="vp-kicker">Last build</p>
          <h2>{lastBuild.title}</h2>
          <p className="text-sm text-muted-foreground mb-3">{lastBuild.summary}</p>
          <BuildPreview build={lastBuild} />
        </div>
      ) : null}
    </div>
  );
}

function AnalysisTab({ lastBuild }: { lastBuild: BuildResult | null }) {
  const [analysis, setAnalysis] = useState<CodeAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [customHtml, setCustomHtml] = useState("");

  async function runAnalysis() {
    const html = lastBuild?.html ?? customHtml.trim();
    if (!html || html.length < 10) {
      toast.error("Pehle chat mein project banayein ya code paste karein");
      return;
    }
    setBusy(true);
    setAnalysis(null);
    try {
      const result = await analyzeCodeStructure({
        data: { html, projectName: lastBuild?.title },
      });
      setAnalysis(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis fail hui");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vp-dev-section">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Coding Structure Analysis</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {lastBuild
            ? `Last build "${lastBuild.title}" ka code analyze karein — architecture, components, data flow, strengths, weaknesses aur suggestions.`
            : "Code paste karein ya chat mein project banakar yahan analyze karein."}
        </p>

        {!lastBuild ? (
          <Textarea
            value={customHtml}
            onChange={(e) => setCustomHtml(e.target.value)}
            placeholder="HTML/CSS/JS code yahan paste karein…"
            className="mt-3 min-h-[120px] font-mono text-xs"
          />
        ) : null}

        <Button className="mt-3 w-full gap-2" disabled={busy} onClick={runAnalysis}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
          {busy ? "Analyzing… (30-60 seconds)" : "Code analyze karein"}
        </Button>
      </div>

      {analysis ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Overview</p>
            <p className="mt-1 text-sm text-muted-foreground">{analysis.overview}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Architecture</p>
            <p className="mt-1 text-sm text-muted-foreground">{analysis.architecture}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Data Flow</p>
            <p className="mt-1 text-sm text-muted-foreground">{analysis.dataFlow}</p>
          </div>

          {analysis.components.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Components ({analysis.components.length})</p>
              <ul className="mt-2 space-y-2">
                {analysis.components.map((c, i) => (
                  <li key={i} className="text-xs">
                    <b className="text-primary">{c.name}</b>
                    <span className="text-muted-foreground"> — {c.purpose}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.techStack.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">Tech Stack</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.techStack.map((t, i) => (
                  <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs">{t}</span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
              <p className="text-sm font-semibold text-success">Strengths</p>
              <ul className="mt-2 space-y-1">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-destructive">Weaknesses</p>
              <ul className="mt-2 space-y-1">
                {analysis.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {analysis.suggestions.length > 0 ? (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-semibold">Improvement Suggestions</p>
              <ul className="mt-2 space-y-2">
                {analysis.suggestions.map((s, i) => (
                  <li key={i} className="text-xs">
                    <b>{s.title}</b>
                    <p className="text-muted-foreground">{s.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ServersTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [adding, setAdding] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const serversQ = useQuery({ queryKey: ["virtual-servers"], queryFn: () => listVirtualServers() });
  const servers = serversQ.data?.servers ?? [];

  async function handleAdd() {
    if (!name.trim()) { toast.error("Server ka naam likhein"); return; }
    setAdding(true);
    try {
      await addVirtualServer({ data: { name: name.trim(), host: host.trim() } });
      qc.invalidateQueries({ queryKey: ["virtual-servers"] });
      setName("");
      setHost("");
      toast.success("Server add ho gaya");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Server add nahi hua");
    } finally {
      setAdding(false);
    }
  }

  async function handleConnect(server: VirtualServer) {
    setConnecting(server.id);
    try {
      await connectVirtualServer({ data: { id: server.id } });
      qc.invalidateQueries({ queryKey: ["virtual-servers"] });
      toast.success(server.status === "online" ? "Server disconnect ho gaya" : "Server connect ho gaya");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection fail hui");
    } finally {
      setConnecting(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteVirtualServer({ data: { id } });
      qc.invalidateQueries({ queryKey: ["virtual-servers"] });
      toast.success("Server delete ho gaya");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete nahi hua");
    }
  }

  return (
    <div className="vp-dev-section">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Virtual Server Connection</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Virtual server add karein jahan aap apne projects deploy kar sakte hain. Server connect hone par aap usay development target ke tor pe istemal kar sakte hain.
        </p>
        <div className="mt-3 space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Server naam (misal: My VPS)" />
          <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Host ya IP (optional, misal: 192.168.1.1)" />
          <Button className="w-full gap-2" disabled={adding} onClick={handleAdd}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Server add karein
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Connected Servers ({servers.length})</p>
        {serversQ.isLoading ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div> : null}
        {!serversQ.isLoading && servers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Server className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Abhi koi server nahi. Upar server add karein.</p>
          </div>
        ) : null}
        {servers.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`vp-server-dot ${s.status === "online" ? "is-online" : ""}`} />
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.host || "No host set"} · {s.status}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant={s.status === "online" ? "outline" : "default"} disabled={connecting === s.id} onClick={() => handleConnect(s)}>
                  {connecting === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : s.status === "online" ? "Disconnect" : "Connect"}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            {s.last_connected_at ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Last connected: {new Date(s.last_connected_at).toLocaleString()}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ApkTab({ lastBuild }: { lastBuild: BuildResult | null }) {
  const [packaging, setPackaging] = useState(false);
  const [apkResult, setApkResult] = useState<{ html: string; fileName: string } | null>(null);

  async function handlePackage() {
    if (!lastBuild) {
      toast.error("Pehle chat mein project banayein");
      return;
    }
    setPackaging(true);
    setApkResult(null);
    try {
      const result = await packageApk({ data: { html: lastBuild.html, title: lastBuild.title } });
      setApkResult({ html: result.html, fileName: result.fileName });
      toast.success("APK/PWA package ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Packaging fail hui");
    } finally {
      setPackaging(false);
    }
  }

  function downloadApk() {
    if (!apkResult) return;
    const blob = new Blob([apkResult.html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${apkResult.fileName}-pwa.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="vp-dev-section">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Smartphone size={22} />
          </span>
          <div>
            <p className="text-sm font-semibold">APK / PWA Packaging</p>
            <p className="text-xs text-muted-foreground">Apne built project ko mobile-installable PWA mein convert karein.</p>
          </div>
        </div>

        {!lastBuild ? (
          <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Pehle chat mein koi app, game ya website banayein. Phir yahan aa kar usay APK/PWA mein package karein.
          </p>
        ) : (
          <>
            <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs"><b>Project:</b> {lastBuild.title}</p>
              <p className="text-xs text-muted-foreground">{lastBuild.summary}</p>
            </div>
            <Button className="mt-3 w-full gap-2" disabled={packaging} onClick={handlePackage}>
              {packaging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              {packaging ? "Packaging…" : "APK/PWA package karein"}
            </Button>
          </>
        )}
      </div>

      {apkResult ? (
        <div className="rounded-2xl border border-primary/40 bg-card p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold">PWA Package Ready!</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Yeh PWA file mobile browser mein khul kar "Add to Home Screen" se install ho sakti hai. Yeh standalone app ki tarah chalega.
          </p>
          <div className="mt-3 flex gap-2">
            <Button className="gap-2" onClick={downloadApk}>
              <Download className="h-4 w-4" /> Download PWA
            </Button>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <iframe
              title="PWA Preview"
              srcDoc={apkResult.html}
              sandbox="allow-scripts allow-forms allow-modals"
              className="h-[400px] w-full bg-background"
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">PWA kya hai?</p>
        <p>PWA (Progressive Web App) ek web app hai jo mobile par install ho kar native app ki tarah chalti hai. Browser mein file khol kar "Add to Home Screen" select karein. App icon home screen par aayega aur standalone mode mein chalega.</p>
      </div>
    </div>
  );
}
