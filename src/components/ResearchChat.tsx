import { useRef, useState } from "react";
import { toast } from "sonner";
import { Brain, ImagePlus, Loader2, Mic, Send, X } from "lucide-react";
import { researchAndPlan, uploadReference } from "@/lib/brain.functions";
import type { PlanResult } from "@/lib/brain.functions";
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
type Msg = { role: "user" | "brain"; text: string; plan?: PlanResult };

export function ResearchChat({
  onPlan,
}: {
  onPlan: (plan: PlanResult) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState<Platform>("auto");
  const [voiceNote, setVoiceNote] = useState("");
  const [showVoice, setShowVoice] = useState(false);
  const [refs, setRefs] = useState<Array<{ path: string; preview: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setMsgs((m) => [...m, { role: "user", text: command }]);
    setText("");
    setBusy(true);
    try {
      const plan = await researchAndPlan({
        data: { command, platform, refPaths: refs.map((r) => r.path), voiceNote, quality: "draft" },
      });
      setMsgs((m) => [...m, { role: "brain", text: plan.reply, plan }]);
      setRefs([]);
      onPlan(plan);
    } catch (e) {
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
          <p className="text-sm font-semibold">Vision Pilot Research Brain</p>
          <p className="text-xs text-muted-foreground">Kisi bhi zubaan mein command dein</p>
        </div>
      </div>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto px-1">
        {msgs.length === 0 ? (
          <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            Misal: "USA audience ke liye New York travel vlog, realistic western style" ya "Japanese
            audience ke liye Python course ka pehla lesson"
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
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Web par research ho rahi hai, earning plan ban raha hai… (1-2 minute)
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
