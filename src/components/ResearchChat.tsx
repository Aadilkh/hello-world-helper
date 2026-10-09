import { useRef, useState } from "react";
import { toast } from "sonner";
import { Brain, ImagePlus, Loader2, Mic, Send, X, Video, Link as LinkIcon } from "lucide-react";
import { researchAndPlan, uploadReference } from "@/lib/brain.functions";
import { analyzeVideoScene, analyzeTutorialVideo } from "@/lib/video-reference.functions";
import type { TutorialAnalysis } from "@/lib/video-reference.functions";
import { captureVideoFrames, captureVideoAudio, captureFullVideoFrames, parseSceneTime, isTutorialRequest } from "@/lib/video-reference";
import type { PlanResult } from "@/lib/brain.functions";
import { buildProject, classifyCommand, runAutonomousDevelopment } from "@/lib/upgrade.functions";
import type { BuildResult, Step } from "@/lib/upgrade.functions";
import { BuildPreview } from "@/components/BuildPreview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const PLATFORMS = [
  ["auto", "Auto"],
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["x", "X"],
] as const;

type Platform = (typeof PLATFORMS)[number][0];
type Msg = { role: "user" | "brain"; text: string; plan?: PlanResult; steps?: Step[]; build?: BuildResult; tutorial?: TutorialAnalysis };

export function ResearchChat({
  onPlan,
  onBuild,
}: {
  onPlan: (plan: PlanResult) => void;
  onBuild?: (build: BuildResult | null) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState<Platform>("auto");
  const [voiceNote, setVoiceNote] = useState("");
  const [showVoice, setShowVoice] = useState(false);
  const [refs, setRefs] = useState<Array<{ path: string; preview: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoLink, setVideoLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [referenceNote, setReferenceNote] = useState("");
  const [lastBuild, setLastBuild] = useState<BuildResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (refs.length >= 3) { toast.error("Zyada se zyada 3 photos"); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error("Photo parh nahi saki"));
        r.readAsDataURL(file);
      });
      const { path } = await uploadReference({ data: { dataUrl, fileName: file.name } });
      setRefs((p) => [...p, { path, preview: dataUrl }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Photo upload nahi hui");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    const command = text.trim();
    if (command.length < 3) { toast.error("Apni command likhein"); return; }
    const source = videoFile ?? videoLink.trim();
    if (source && typeof source === "string" && !/^https:\/\/[^\s]+$/i.test(source)) {
      toast.error("Mukammal HTTPS video link dein"); return;
    }
    setMsgs((m) => [...m, { role: "user", text: command }]);
    setText("");
    setBusy(true);
    try {
      if (source) {
        const sceneAt = parseSceneTime(command);
        const tutorialMode = sceneAt === null && isTutorialRequest(command);
        if (sceneAt === null && !tutorialMode) {
          setMsgs((m) => [...m, { role: "brain", text: "Scene ka waqt likhein (misal 2:22) ya tutorial/course video ke liye \"samjho\", \"summarize\" ya \"tutorial\" likhein." }]);
          setText(command);
          return;
        }
        if (tutorialMode) {
          setMsgs((m) => [...m, { role: "brain", text: "Poora video analyze ho raha hai… frames nikal rahe hoon (1-2 minute)" }]);
          const { frames, duration } = await captureFullVideoFrames(source);
          const tutorial = await analyzeTutorialVideo({ data: { command, frames, duration } });
          const chaptersText = tutorial.chapters.map((c) => `${c.time} — ${c.title}`).join("\n");
          const keyPointsText = tutorial.keyPoints.map((p) => `• ${p}`).join("\n");
          const note = `Tutorial reference: ${tutorial.title}. Topic: ${tutorial.topic}. Difficulty: ${tutorial.difficulty}. Language: ${tutorial.language}. Key points: ${tutorial.keyPoints.join("; ")}. Adaptation: ${tutorial.adaptation}. Do not copy the original content.`;
          setReferenceNote(note);
          setMsgs((m) => [...m, { role: "brain", text: `${tutorial.title}\n\nTopic: ${tutorial.topic}\nLanguage: ${tutorial.language} · Difficulty: ${tutorial.difficulty}\n\nSummary:\n${tutorial.summary}\n\nKey points:\n${keyPointsText}\n\nChapters:\n${chaptersText}\n\nNaye content ke liye: ${tutorial.adaptation}`, tutorial }]);
          setVideoFile(null);
          setVideoLink("");
          return;
        }
        const { frames } = await captureVideoFrames(source, sceneAt!);
        let audioDataUrl: string | null = null;
        try {
          const audioResult = await captureVideoAudio(source, sceneAt!);
          audioDataUrl = audioResult.audioDataUrl;
        } catch {
          audioDataUrl = null;
        }
        const analysis = await analyzeVideoScene({ data: { command, sceneAt: sceneAt!, frames, audioDataUrl } });
        const speechLine = analysis.speech && analysis.speech.trim().length > 0 ? `\nBol chaal: ${analysis.speech}` : "";
        const note = `Reference at ${sceneAt}s: ${analysis.movement}; expression: ${analysis.expression}.${speechLine ? ` Speech: ${analysis.speech}.` : ""} Original adaptation: ${analysis.adaptation}. Do not copy the original person or footage.`;
        setReferenceNote(note);
        setMsgs((m) => [...m, { role: "brain", text: `${analysis.summary}\n\nMovement: ${analysis.movement}\nExpressions: ${analysis.expression}${speechLine}\nNaye content ke liye: ${analysis.adaptation}\n\n${analysis.limitations}` }]);
        setVideoFile(null);
        setVideoLink("");
        return;
      }
      const route = await classifyCommand({ data: { command } });
      if (route.mode === "chat") {
        setMsgs((m) => [...m, { role: "brain", text: route.reply }]);
        return;
      }
      if (route.mode === "build") {
        setMsgs((m) => [...m, { role: "brain", text: "Dev Master: aap ka project bana raha hoon…" }]);
        try {
          const b = await buildProject({ data: { command, previousHtml: lastBuild?.html } });
          setLastBuild(b);
          onBuild?.(b);
          setMsgs((m) => [...m, { role: "brain", text: b.summary, build: b }]);
        } catch (buildErr) {
          // Self-learning loop: sense the gap, learn it, retry once
          setMsgs((m) => [
            ...m,
            { role: "brain", text: `Build mein dushwari hui (${buildErr instanceof Error ? buildErr.message : "nakami"}). Dev Master is kami ko research kar ke seekh raha hai…` },
          ]);
          const r = await runAutonomousDevelopment({ data: { requirement: command } });
          if (r.status === "AUTONOMOUS_DEVELOPMENT_PASS") {
            setMsgs((m) => [
              ...m,
              { role: "brain", text: `Nayi salahiyat "${r.capability?.name}" seekh li. Ab dobara bana raha hoon…`, steps: r.steps },
            ]);
            const b = await buildProject({ data: { command, previousHtml: lastBuild?.html } });
            setLastBuild(b);
            onBuild?.(b);
            setMsgs((m) => [...m, { role: "brain", text: b.summary, build: b }]);
          } else {
            throw buildErr;
          }
        }
        return;
      }
      if (route.mode === "upgrade") {
        setMsgs((m) => [...m, { role: "brain", text: "Dev Master: kami dhoond kar nayi salahiyat bana raha hoon…" }]);
        const r = await runAutonomousDevelopment({ data: { requirement: command } });
        const text =
          r.status === "AUTONOMOUS_DEVELOPMENT_PASS"
            ? `Nayi salahiyat "${r.capability?.name}" ban kar registry mein shamil ho gayi. Ab video plans mein khud istemal hogi.`
            : r.status === "ALREADY_CAPABLE"
              ? "Ye salahiyat pehle se maujood hai."
              : "Nayi salahiyat jaanch mein pass nahi hui.";
        setMsgs((m) => [...m, { role: "brain", text, steps: r.steps }]);
        return;
      }
      const fullCommand = referenceNote ? `${command}\n\n${referenceNote}` : command;
      try {
        const plan = await researchAndPlan({
          data: { command: fullCommand, platform, refPaths: refs.map((r) => r.path), voiceNote, quality: "draft" },
        });
        setMsgs((m) => [...m, { role: "brain", text: plan.reply, plan }]);
        setRefs([]);
        setReferenceNote("");
        onPlan(plan);
      } catch (planErr) {
        // Self-learning loop: sense the gap, learn it, retry once
        setMsgs((m) => [
          ...m,
          { role: "brain", text: `Is kaam mein mujhe dushwari hui (${planErr instanceof Error ? planErr.message : "nakami"}). Dev Master ab is kami ko research kar ke seekh raha hai…` },
        ]);
        const r = await runAutonomousDevelopment({ data: { requirement: command } });
        if (r.status === "AUTONOMOUS_DEVELOPMENT_PASS") {
          setMsgs((m) => [
            ...m,
            { role: "brain", text: `Nayi salahiyat "${r.capability?.name}" seekh li. Ab aapki command nayi salahiyat ke saath dobara chala raha hoon…`, steps: r.steps },
          ]);
          const plan = await researchAndPlan({
            data: { command: fullCommand, platform, refPaths: refs.map((r2) => r2.path), voiceNote, quality: "draft" },
          });
          setMsgs((m) => [...m, { role: "brain", text: plan.reply, plan }]);
          setRefs([]);
          setReferenceNote("");
          onPlan(plan);
        } else if (r.status === "ALREADY_CAPABLE") {
          throw planErr;
        } else {
          setMsgs((m) => [
            ...m,
            { role: "brain", text: "Is kami ko seekhna abhi mumkin nahi hua (jaanch pass nahi hui). Command thori wazeh kar ke dobara bhejein.", steps: r.steps },
          ]);
          setText(command);
        }
      }
    } catch (e) {
      setText(command);
      setMsgs((m) => [
        ...m,
        { role: "brain", text: e instanceof Error ? e.message : "Research nahi ho saki" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Brain className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Vision Pilot + Dev Master</p>
          <p className="text-xs text-muted-foreground">Video, game, app, website — sab yahin se banwayein</p>
        </div>
      </div>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto px-1">
        {msgs.length === 0 ? (
          <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Misal: "USA audience ke liye New York travel vlog, realistic western style" ya "Japanese
            audience ke liye Python course ka pehla lesson" ya "ek snake game banao" ya "meri dukaan ki website banao"
            ya video lagao kar "ye tutorial samjho" ya "is course ka khulasa do" likhein
          </p>
        ) : null}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
              {m.text}
            </div>
          ) : (
            <div key={i} className="max-w-[95%] space-y-2 text-sm">
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.steps ? (
                <ul className="space-y-1 rounded-xl bg-muted/40 p-2 text-xs">
                  {m.steps.map((st, j) => (
                    <li key={j}>
                      {st.status === "PASS" ? "✓" : st.status === "FAIL" ? "✗" : "–"} <b>{st.step}:</b>{" "}
                      <span className="text-muted-foreground">{st.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {m.build ? <BuildPreview build={m.build} /> : null}
              {m.tutorial ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{m.tutorial.language}</span>
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 font-semibold text-accent-foreground">{m.tutorial.difficulty}</span>
                  </div>
                  <p className="mb-2 font-semibold">Chapters:</p>
                  <ul className="space-y-1">
                    {m.tutorial.chapters.map((ch, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="font-mono text-muted-foreground">{ch.time}</span>
                        <span>{ch.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {m.plan ? (
                <p className="text-xs text-muted-foreground">
                  {m.plan.platform} · {m.plan.audience} · {m.plan.niche} — neeche plan aur scenes dekhein
                </p>
              ) : null}
            </div>
          ),
        )}
        {busy ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Kaam ho raha hai… (1-2 minute)
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PLATFORMS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setPlatform(v)}
            className={`rounded-full border px-2.5 py-1 text-xs ${platform === v ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {refs.length > 0 ? (
        <div className="mt-2 flex gap-2">
          {refs.map((r, i) => (
            <div key={r.path} className="relative">
              <img src={r.preview} alt="Reference" className="h-14 w-14 rounded-lg object-cover" />
              <button
                aria-label="Hatao"
                onClick={() => setRefs((p) => p.filter((_, j) => j !== i))}
                className="absolute -right-1 -top-1 rounded-full bg-background p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {videoFile || videoLink || referenceNote ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Video className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{videoFile?.name || videoLink || "Scene ka khulasa aglay video mein istemal hoga"}</span>
          <Button size="icon" variant="ghost" aria-label="Video reference hatao" title="Video reference hatao" onClick={() => { setVideoFile(null); setVideoLink(""); setReferenceNote(""); }}><X className="h-4 w-4" /></Button>
        </div>
      ) : null}

      {showLink ? (
        <input type="url" value={videoLink} onChange={(e) => { setVideoLink(e.target.value); setVideoFile(null); }} placeholder="Direct public MP4 video link (https://…)" aria-label="Video link" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs" />
      ) : null}

      {showVoice ? (
        <input
          value={voiceNote}
          onChange={(e) => setVoiceNote(e.target.value)}
          placeholder="Awaaz ka style: misal 'gehri mardana awaaz, dheema andaz'"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
        />
      ) : null}

      <div className="mt-2 rounded-xl border border-border bg-background">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Apna idea ya command likhein…"
          className="min-h-[70px] resize-none border-0 bg-transparent focus-visible:ring-0"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex gap-1">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <Button type="button" size="icon" variant="ghost" aria-label="Photo lagao" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            </Button>
            <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 100 * 1024 * 1024) toast.error("Video 100MB se chhoti honi chahiye"); else { setVideoFile(file); setVideoLink(""); setShowLink(false); } } e.target.value = ""; }} />
            <Button type="button" size="icon" variant="ghost" aria-label="Video lagao" title="Video lagao" onClick={() => videoRef.current?.click()}><Video className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant={showLink ? "secondary" : "ghost"} aria-label="Video link lagao" title="Direct video link lagao" onClick={() => setShowLink((v) => !v)}><LinkIcon className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant={showVoice ? "secondary" : "ghost"} aria-label="Awaaz ka style" onClick={() => setShowVoice((s) => !s)}>
              <Mic className="h-4 w-4" />
            </Button>
          </div>
          <Button size="icon" aria-label="Bhejo" disabled={busy} onClick={send}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
