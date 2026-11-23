import { useRef, useState } from "react";
import { Check, Film, ImagePlus, KeyRound, Loader2, Play, RefreshCw, Send, Settings2, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateScript, type ScriptScene } from "@/lib/video.functions";
import { pollVeoClip, startVeoClip, type VeoClip } from "@/lib/veo.functions";

type EngineMode = "text" | "image" | "scene" | "assembly";
type Model = "veo-3.1-generate-001" | "veo-3.1-fast-generate-001";

type Script = { title: string; hook: string; scenes: ScriptScene[] };

export function VisionPilotVideoEngine() {
  const [mode, setMode] = useState<EngineMode>("text");
  const [idea, setIdea] = useState("");
  const [language, setLanguage] = useState<"urdu" | "english">("urdu");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [model, setModel] = useState<Model>("veo-3.1-fast-generate-001");
  const [apiKey, setApiKey] = useState("");
  const [script, setScript] = useState<Script | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [clips, setClips] = useState<VeoClip[]>([]);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingScene, setGeneratingScene] = useState<number | null>(null);
  const [assembledUrl, setAssembledUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  async function createScript() {
    if (idea.trim().length < 3) return void toast.error("Pehle video idea likhein");
    setBusy(true);
    setScript(null);
    setClips([]);
    setProjectId(null);
    setAssembledUrl(null);
    try {
      const result = await generateScript({ data: { idea: idea.trim(), language, quality: "hd", aspectRatio } });
      const nextScript = result.project as { id: string; title: string; hook: string; scenes: ScriptScene[] };
      setProjectId(nextScript.id);
      setScript({ title: nextScript.title, hook: nextScript.hook, scenes: nextScript.scenes });
      setMode("scene");
      toast.success("Creative Engine ne script tayyar kar di");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Script nahi ban saki");
    } finally {
      setBusy(false);
    }
  }

  async function generateScene(sceneIndex: number) {
    if (!projectId || !script) return;
    if (apiKey.trim().length < 20) return void toast.error("Settings mein Google Cloud API key enter karein");
    setGeneratingScene(sceneIndex);
    try {
      const started = await startVeoClip({
        data: {
          projectId,
          sceneIndex,
          apiKey: apiKey.trim(),
          model,
          imageDataUrl: mode === "image" && sceneIndex === 0 ? imageDataUrl : null,
        },
      });
      if (!started.operationName) throw new Error("Veo operation start nahi hui");
      let current = started.clip;
      for (let attempt = 0; attempt < 45; attempt += 1) {
        setClips((previous) => mergeClip(previous, current));
        if (current.status === "ready") break;
        await wait(8000);
        const polled = await pollVeoClip({ data: { projectId, clipId: current.id, operationName: started.operationName, apiKey: apiKey.trim() } });
        current = polled.clip;
        if (polled.done) break;
      }
      setClips((previous) => mergeClip(previous, current));
      if (current.status === "ready") toast.success(`Scene ${sceneIndex + 1} ready hai`);
      else toast.message(`Scene ${sceneIndex + 1} abhi processing mein hai`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Veo scene generate nahi kar saka");
    } finally {
      setGeneratingScene(null);
    }
  }

  async function generateAllScenes() {
    if (!script) return;
    setBusy(true);
    try {
      for (let index = 0; index < script.scenes.length; index += 1) await generateScene(index);
    } finally {
      setBusy(false);
    }
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Sirf image file select karein");
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.onerror = () => toast.error("Image read nahi ho saki");
    reader.readAsDataURL(file);
  }

  async function assemble() {
    const readyClips = clips.filter((clip) => clip.status === "ready" && clip.url);
    if (readyClips.length < 2) return void toast.error("Assembly ke liye kam az kam 2 ready scenes chahiye");
    setBusy(true);
    try {
      const url = await assembleVideos(readyClips.sort((a, b) => a.scene_index - b.scene_index).map((clip) => clip.url!));
      setAssembledUrl(url);
      toast.success("Full video assemble ho gayi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Video assembly fail hui");
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ id: EngineMode; label: string; icon: typeof Film }> = [
    { id: "text", label: "Text-to-Video", icon: WandSparkles },
    { id: "image", label: "Image-to-Video", icon: ImagePlus },
    { id: "scene", label: "Scene Generation", icon: Film },
    { id: "assembly", label: "Video Assembly", icon: Play },
  ];

  return (
    <div className="vp-content-wrap">
      <div className="vp-page-heading vp-inner-title">
        <div>
          <p className="vp-kicker"><span className="vp-kicker-dot" /> Dedicated creative module</p>
          <h1>VISIONPILOT VIDEO GENERATION ENGINE</h1>
          <p className="vp-subtitle">Creative Engine se script, Veo se scenes, aur yahan se full video.</p>
        </div>
        <span className="vp-engine-badge"><span className="vp-live-dot" /> Separate from Dev Master</span>
      </div>

      <div className="vp-engine-flow">
        <span className="is-active">1. Idea</span><span>→</span><span className={script ? "is-active" : ""}>2. Script</span><span>→</span><span className={clips.length ? "is-active" : ""}>3. Veo clips</span><span>→</span><span className={assembledUrl ? "is-active" : ""}>4. Full video</span>
      </div>

      <section className="vp-engine-card">
        <div className="vp-engine-card-head"><div><p className="vp-kicker">Google Veo 3.1</p><h2>Engine settings</h2></div><Settings2 size={19} /></div>
        <div className="vp-engine-settings-grid">
          <label><span>Google Cloud API key</span><Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste key — session only" autoComplete="off" /></label>
          <label><span>Veo model</span><select value={model} onChange={(event) => setModel(event.target.value as Model)}><option value="veo-3.1-fast-generate-001">Veo 3.1 Fast</option><option value="veo-3.1-generate-001">Veo 3.1 Standard</option></select></label>
        </div>
        <p className="vp-engine-note"><KeyRound size={13} /> Key browser mein save nahi hoti. Veo 3.1 ke exact `-001` models Google Cloud / Vertex AI access ke liye hain.</p>
      </section>

      <div className="vp-engine-tabs">{tabs.map((tab) => <button key={tab.id} className={mode === tab.id ? "is-active" : ""} onClick={() => setMode(tab.id)}><tab.icon size={15} /> {tab.label}</button>)}</div>

      {(mode === "text" || mode === "image") && <section className="vp-engine-card">
        <div className="vp-engine-card-head"><div><p className="vp-kicker">Step 1</p><h2>{mode === "image" ? "Animate an image" : "Start with an idea"}</h2></div><Sparkles size={19} /></div>
        <Textarea value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Misal: Karachi ki barish mein ek chai seller ki cinematic kahani…" className="min-h-[110px]" />
        <div className="vp-engine-form-row"><select value={language} onChange={(event) => setLanguage(event.target.value as "urdu" | "english")}><option value="urdu">Urdu narration</option><option value="english">English narration</option></select><select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as "9:16" | "16:9")}><option value="9:16">Portrait 9:16</option><option value="16:9">Landscape 16:9</option></select></div>
        {mode === "image" ? <div className="vp-image-picker"><input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => handleImage(event.target.files?.[0])} /><Button variant="outline" onClick={() => imageRef.current?.click()}><ImagePlus size={15} /> {imageDataUrl ? "Image selected" : "Choose starting image"}</Button>{imageDataUrl ? <img src={imageDataUrl} alt="Selected starting frame" /> : null}</div> : null}
        <Button className="mt-3 w-full gap-2" onClick={createScript} disabled={busy}><Sparkles size={15} /> {busy ? "Creative Engine script likh raha hai…" : "Create script and scenes"}</Button>
      </section>}

      {script ? <section className="vp-engine-card">
        <div className="vp-engine-card-head"><div><p className="vp-kicker">Step 2 · Approval required</p><h2>{script.title}</h2></div><Check size={19} /></div>
        <p className="vp-engine-hook">{script.hook}</p>
        <div className="vp-scene-list">{script.scenes.map((scene, index) => <article key={`${scene.visual}-${index}`} className="vp-scene-card"><div className="vp-scene-number">{index + 1}</div><div><b>{scene.visual}</b><p>{scene.narration}</p><small>{scene.durationSeconds}s · {clips.find((clip) => clip.scene_index === index)?.status ?? "not generated"}</small></div><Button size="sm" variant="outline" disabled={generatingScene !== null} onClick={() => generateScene(index)}>{generatingScene === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Generate</Button></article>)}</div>
        <div className="vp-engine-actions"><Button className="gap-2" disabled={busy || generatingScene !== null} onClick={generateAllScenes}><Film size={15} /> Approve script &amp; generate all scenes</Button><Button variant="outline" onClick={() => setScript(null)}>Edit idea</Button></div>
      </section> : null}

      {mode === "assembly" || clips.length > 0 ? <section className="vp-engine-card"><div className="vp-engine-card-head"><div><p className="vp-kicker">Step 4</p><h2>Video assembly</h2></div><RefreshCw size={19} /></div><div className="vp-clip-grid">{clips.sort((a, b) => a.scene_index - b.scene_index).map((clip) => <div className="vp-clip-card" key={clip.id}>{clip.url ? <video controls src={clip.url} /> : <div className="vp-clip-placeholder"><Loader2 className="animate-spin" size={20} /><span>{clip.progress}%</span></div>}<p>Scene {clip.scene_index + 1} · {clip.status}</p></div>)}</div><Button className="mt-4 w-full gap-2" disabled={busy || clips.filter((clip) => clip.status === "ready").length < 2} onClick={assemble}><Play size={15} /> Assemble ready clips into full video</Button>{assembledUrl ? <div className="vp-assembled-result"><video controls src={assembledUrl} /><a href={assembledUrl} download="visionpilot-video.webm" className="vp-primary-button">Download assembled video</a></div> : null}</section> : null}
    </div>
  );
}

function mergeClip(previous: VeoClip[], next: VeoClip): VeoClip[] {
  return [...previous.filter((clip) => clip.id !== next.id), next].sort((a, b) => a.scene_index - b.scene_index);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function assembleVideos(urls: string[]): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Video canvas available nahi hai");
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
  const finished = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" })); });
  recorder.start();
  for (const url of urls) {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = url;
    video.muted = true;
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error("Clip load nahi hui")); video.load(); });
    await video.play();
    while (!video.ended) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      await wait(33);
    }
    video.pause();
  }
  recorder.stop();
  return URL.createObjectURL(await finished);
}
