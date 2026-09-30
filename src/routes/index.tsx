import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Clapperboard,
  Sparkles,
  Loader2,
  Download,
  Wand2,
  Film,
  RotateCcw,
  History,
} from "lucide-react";
import { generateScript, createClipJob, getProject, listProjects } from "@/lib/video.functions";
import type { ScriptScene, ClipRow } from "@/lib/video.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResearchChat } from "@/components/ResearchChat";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReelBanao — AI Video Studio" },
      {
        name: "description",
        content:
          "Apna idea likhein aur AI aap ke liye script aur video bana de — Reels aur YouTube ke liye.",
      },
      { property: "og:title", content: "ReelBanao — AI Video Studio" },
      {
        property: "og:description",
        content: "Idea se seedha video — AI script likhta hai, scenes generate karta hai.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Project = {
  id: string;
  idea: string;
  language: string;
  quality: string;
  aspect_ratio: string;
  title: string | null;
  hook: string | null;
  scenes: ScriptScene[];
  platform?: string | null;
  audience?: string | null;
  monetization?: { verdict?: string; rpmNote?: string; rules?: string[]; avoid?: string[] } | null;
  research?: Array<{ title: string; url: string; note: string }> | null;
};

function Index() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"brain" | "quick">("brain");
  const [idea, setIdea] = useState("");
  const [language, setLanguage] = useState<"urdu" | "english">("urdu");
  const [quality, setQuality] = useState<"draft" | "hd">("draft");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [writingScript, setWritingScript] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  const projectsQ = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: () => getProject({ data: { projectId: projectId! } }),
    refetchInterval: (query) => {
      const clips = query.state.data?.clips ?? [];
      return clips.some((c) => c.status === "in_progress" || c.status === "pending") ? 5000 : false;
    },
  });

  const project = projectQ.data?.project as Project | undefined;
  const clips = (projectQ.data?.clips ?? []) as ClipRow[];

  async function handleGenerateScript() {
    if (idea.trim().length < 3) {
      toast.error("Pehle apna video idea likhein");
      return;
    }
    setWritingScript(true);
    try {
      const res = await generateScript({ data: { idea: idea.trim(), language, quality, aspectRatio } });
      setProjectId(res.project.id);
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Script nahi ban saki");
    } finally {
      setWritingScript(false);
    }
  }

  async function generateScene(
    sceneIndex: number,
    opts?: { resolution: "360p" | "720p" | "1080p"; durationSeconds: number },
  ) {
    if (!projectId) return;
    try {
      await createClipJob({ data: { projectId, sceneIndex, ...(opts ?? {}) } });
      await qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Video start nahi hua");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    }
  }

  async function handleGenerateAll(scenes: ScriptScene[] | undefined) {
    if (!projectId || !scenes) return;
    setGeneratingAll(true);
    for (let i = 0; i < scenes.length; i++) {
      try {
        await createClipJob({ data: { projectId, sceneIndex: i } });
        await qc.invalidateQueries({ queryKey: ["project", projectId] });
        qc.invalidateQueries({ queryKey: ["projects"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Scene ${i + 1} start nahi hua`);
        break;
      }
    }
    setGeneratingAll(false);
  }

  function resetToForm() {
    setProjectId(null);
    setIdea("");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clapperboard className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">ReelBanao</span>
          </div>
          {project ? (
            <Button variant="ghost" size="sm" onClick={resetToForm} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Naya video
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-5">
        {!project ? (
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-border bg-card p-1 text-sm">
            <button
              onClick={() => setMode("brain")}
              className={`rounded-full py-1.5 ${mode === "brain" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Research Brain
            </button>
            <button
              onClick={() => setMode("quick")}
              className={`rounded-full py-1.5 ${mode === "quick" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Seedha script
            </button>
          </div>
        ) : null}
        {!project && mode === "brain" ? (
          <ResearchChat
            onPlan={(plan) => {
              setProjectId(plan.projectId);
              qc.invalidateQueries({ queryKey: ["projects"] });
            }}
          />
        ) : !project ? (
          <IdeaForm
            idea={idea}
            setIdea={setIdea}
            language={language}
            setLanguage={setLanguage}
            quality={quality}
            setQuality={setQuality}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            loading={writingScript}
            onSubmit={handleGenerateScript}
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h1 className="font-display text-xl font-bold leading-snug">{project.title}</h1>
              {project.hook ? (
                <p
                  dir={project.language === "urdu" ? "rtl" : "ltr"}
                  className="mt-2 text-sm text-muted-foreground"
                >
                  {project.hook}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{project.aspect_ratio}</Badge>
                <Badge>{project.quality === "hd" ? "HD 720p" : "Draft 360p"}</Badge>
                <Badge>{project.language} narration</Badge>
                {project.platform ? <Badge>{project.platform}</Badge> : null}
                {project.audience ? <Badge>{project.audience}</Badge> : null}
              </div>
            </div>

            {project.monetization?.verdict ? (
              <div className="rounded-2xl border border-primary/40 bg-card p-4 text-sm">
                <p className="font-semibold text-primary">Earning plan</p>
                <p className="mt-1">{project.monetization.verdict}</p>
                {project.monetization.rpmNote ? (
                  <p className="mt-1 text-xs text-muted-foreground">{project.monetization.rpmNote}</p>
                ) : null}
                {project.monetization.rules?.length ? (
                  <>
                    <p className="mt-3 text-xs font-semibold">Platform rules jo follow kiye:</p>
                    <ul className="ml-4 list-disc text-xs text-muted-foreground">
                      {project.monetization.rules.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                ) : null}
                {project.monetization.avoid?.length ? (
                  <>
                    <p className="mt-3 text-xs font-semibold">Ye na karein (earning khatam):</p>
                    <ul className="ml-4 list-disc text-xs text-muted-foreground">
                      {project.monetization.avoid.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}

            {project.research?.length ? (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                <p className="font-semibold">Research ke saboot</p>
                <ul className="mt-2 space-y-2">
                  {project.research.map((e, i) => (
                    <li key={i} className="text-xs">
                      <a href={e.url} target="_blank" rel="noreferrer" className="text-primary underline">
                        {e.title || e.url}
                      </a>
                      <p className="text-muted-foreground">{e.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}


            <Button
              className="w-full gap-2"
              disabled={generatingAll || clips.every((c) => c.status === "ready")}
              onClick={() => handleGenerateAll(project.scenes)}
            >
              {generatingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Sab scenes ke videos banao
            </Button>

            {projectQ.isLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {project.scenes.map((scene, i) => (
                  <SceneCard
                    key={i}
                    index={i}
                    scene={scene}
                    clip={clips.find((c) => c.scene_index === i)}
                    language={project.language}
                    aspectRatio={project.aspect_ratio}
                    onGenerate={(opts) => generateScene(i, opts)}
                    generating={generatingAll}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <RecentProjects
          projects={projectsQ.data?.projects ?? []}
          onOpen={(id) => {
            setProjectId(id);
            window.scrollTo({ top: 0 });
          }}
        />
      </main>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-muted/40 text-muted-foreground")
      }
    >
      {children}
    </button>
  );
}

function IdeaForm(props: {
  idea: string;
  setIdea: (v: string) => void;
  language: "urdu" | "english";
  setLanguage: (v: "urdu" | "english") => void;
  quality: "draft" | "hd";
  setQuality: (v: "draft" | "hd") => void;
  aspectRatio: "9:16" | "16:9";
  setAspectRatio: (v: "9:16" | "16:9") => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-bold leading-tight">
          Idea likho,{" "}
          <span className="text-primary">video ban jayega</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          AI aap ki script likhega, phir har scene ki video generate karega.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <Textarea
          value={props.idea}
          onChange={(e) => props.setIdea(e.target.value)}
          placeholder="Misal: Karachi ki barish par ek mazedaar reel — chai, pakora aur yaadein"
          rows={4}
          dir="auto"
          className="resize-none border-border bg-muted/30 text-base"
        />

        <div className="space-y-2">
          <Label>Narration ki zubaan</Label>
          <div className="flex gap-2">
            <Chip active={props.language === "urdu"} onClick={() => props.setLanguage("urdu")}>
              اردو
            </Chip>
            <Chip active={props.language === "english"} onClick={() => props.setLanguage("english")}>
              English
            </Chip>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Format</Label>
          <div className="flex gap-2">
            <Chip active={props.aspectRatio === "9:16"} onClick={() => props.setAspectRatio("9:16")}>
              Reels / TikTok
            </Chip>
            <Chip active={props.aspectRatio === "16:9"} onClick={() => props.setAspectRatio("16:9")}>
              YouTube
            </Chip>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Quality</Label>
          <div className="flex gap-2">
            <Chip active={props.quality === "draft"} onClick={() => props.setQuality("draft")}>
              Draft (tez, sasta)
            </Chip>
            <Chip active={props.quality === "hd"} onClick={() => props.setQuality("hd")}>
              HD 720p
            </Chip>
          </div>
        </div>

        <Button
          className="w-full gap-2 text-base font-semibold"
          size="lg"
          disabled={props.loading}
          onClick={props.onSubmit}
        >
          {props.loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          {props.loading ? "AI script likh raha hai..." : "Script banao"}
        </Button>
        {props.loading ? (
          <p className="text-center text-xs text-muted-foreground">
            30 second se 1 minute lag sakta hai
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}

type ClipOptions = { resolution: "360p" | "720p" | "1080p"; durationSeconds: number };

function useElapsed(startedAt: string | null | undefined, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!startedAt) return 0;
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.round((now - started) / 1000));
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SceneCard({
  index,
  scene,
  clip,
  language,
  aspectRatio,
  onGenerate,
  generating,
}: {
  index: number;
  scene: ScriptScene;
  clip?: ClipRow | undefined;
  language: string;
  aspectRatio: string;
  onGenerate: (opts: ClipOptions) => void;
  generating: boolean;
}) {
  const status = clip?.status ?? "none";
  const rtl = language === "urdu";
  const [resolution, setResolution] = useState<"360p" | "720p" | "1080p">(
    (clip?.resolution as "360p" | "720p" | "1080p") ?? "360p",
  );
  const [duration, setDuration] = useState<number>(
    clip?.duration_seconds ?? Math.min(10, Math.max(3, scene.durationSeconds || 8)),
  );
  const working = status === "in_progress" || status === "pending";
  const elapsed = useElapsed(clip?.started_at, working);
  const pct = working ? Math.max(clip?.progress ?? 5, Math.min(95, 5 + elapsed * 1.2)) : 0;


  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Film className="h-3.5 w-3.5" /> Scene {index + 1}
        </span>
        <span className="text-xs text-muted-foreground">
          {clip?.duration_seconds ?? duration}s · {clip?.resolution ?? resolution}
        </span>
      </div>
      <div className="px-4 pt-2">
        <p
          dir={rtl ? "rtl" : "ltr"}
          className={"text-[15px] font-medium leading-relaxed " + (rtl ? "text-right" : "text-left")}
        >
          {scene.narration}
        </p>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground" dir="ltr">
          {scene.visual}
        </p>
      </div>

      <div className="mt-3">
        {status === "ready" && clip ? (
          <div className="space-y-2">
            <video
              src={clip.url ?? undefined}
              controls
              loop
              playsInline
              className={
                "w-full bg-black " + (aspectRatio === "9:16" ? "aspect-[9/16] object-cover" : "aspect-video")
              }
            />
            <div className="flex items-center gap-2 px-4 pb-4">
              <Button asChild className="flex-1 gap-2">
                <a href={clip.url ?? "#"} download={`scene-${index + 1}.mp4`} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" /> Video download karein
                </a>
              </Button>
              <Button
                variant="outline"
                size="icon"
                title="Dobara banao"
                onClick={() => onGenerate({ resolution, durationSeconds: duration })}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : working ? (
          <div className="px-4 pb-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${Math.round(pct)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Video ban raha hai… {Math.round(pct)}%
              </span>
              <span className="tabular-nums">{fmtTime(elapsed)}</span>
            </div>
          </div>
        ) : status === "failed" ? (
          <div className="px-4 pb-4">
            <p className="text-xs text-destructive">{clip?.error ?? "Video fail ho gaya"}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 gap-1.5"
              onClick={() => onGenerate({ resolution, durationSeconds: duration })}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Dobara koshish
            </Button>
          </div>
        ) : (
          <div className="space-y-3 px-4 pb-4">
            <div className="space-y-2">
              <Label>Quality</Label>
              <div className="flex gap-2">
                {(["360p", "720p", "1080p"] as const).map((r) => (
                  <Chip key={r} active={resolution === r} onClick={() => setResolution(r)}>
                    {r === "360p" ? "360p (sasta)" : r}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Lambai — {duration} second</Label>
              <input
                type="range"
                min={3}
                max={10}
                step={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
            </div>
            <Button
              className="w-full gap-2"
              disabled={generating}
              onClick={() => onGenerate({ resolution, durationSeconds: duration })}
            >
              <Sparkles className="h-4 w-4" /> Video banao
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentProjects({
  projects,
  onOpen,
}: {
  projects: Array<{
    id: string;
    title: string | null;
    idea: string;
    total?: number;
    ready?: number;
  }>;
  onOpen: (id: string) => void;
}) {
  if (projects.length === 0) return null;
  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <History className="h-3.5 w-3.5" /> Purane videos
      </div>
      <div className="space-y-2">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(p.id)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{p.title ?? p.idea}</span>
              <span className="text-xs text-muted-foreground">
                {p.ready ?? 0}/{p.total ?? 0} videos ready
              </span>
            </span>
            <span className="ml-3 shrink-0 text-xs font-medium text-primary">Kholein</span>
          </button>
        ))}
      </div>
    </div>
  );
}
