export type VideoFrame = { at: number; dataUrl: string };

export function parseSceneTime(rawCommand: string): number | null {
  const words = rawCommand.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?\.?|منٹ)\s*(\d{1,2})\s*(?:sec(?:ond)?s?\.?|سیکنڈ)?(?=\b|\s|$)/i);
  if (words && Number(words[2]) < 60) return Number(words[1]) * 60 + Number(words[2]);
  const clock = rawCommand.match(/\b(\d{1,3}):(\d{2})\b/);
  if (clock && Number(clock[2]) < 60) return Number(clock[1]) * 60 + Number(clock[2]);
  return null;
}

export async function captureVideoFrames(source: File | string, sceneAt: number): Promise<{ frames: VideoFrame[]; duration: number }> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  if (typeof source === "string") video.crossOrigin = "anonymous";
  const objectUrl = source instanceof File ? URL.createObjectURL(source) : null;
  const src = typeof source === "string" ? source : objectUrl;
  const waitFor = (event: string) => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("Video load nahi hui. MP4 file share karein ya direct public video link dein.")); }, 20000);
    const ok = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error(typeof source === "string" ? "Is link ke frames nahi khul sake. Direct public MP4 link dein ya file upload karein." : "Ye video browser mein nahi chal saki. Doosri MP4 file azmaein.")); };
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, ok); video.removeEventListener("error", fail); };
    video.addEventListener(event, ok, { once: true });
    video.addEventListener("error", fail, { once: true });
  });
  try {
    if (!src) throw new Error("Video file nahi khul saki.");
    video.src = src;
    video.load();
    if (video.readyState < 1) await waitFor("loadedmetadata");
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Video ki lambai nahi parh saki. MP4 file share karein.");
    if (sceneAt >= duration) throw new Error(`Video ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")} tak hai; chhota waqt chunen.`);
    const times = [...new Set([sceneAt - 2, sceneAt - 1, sceneAt, sceneAt + 1, sceneAt + 2]
      .map((t) => Math.max(0, Math.min(duration - 0.1, t))))];
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) throw new Error("Video frames nahi parh sake.");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Video frames nahi parh sake.");
    const frames: VideoFrame[] = [];
    for (const at of times) {
      const seeking = waitFor("seeked");
      video.currentTime = at;
      await seeking;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        frames.push({ at, dataUrl: canvas.toDataURL("image/jpeg", 0.7) });
      } catch (error) {
        throw new Error(`Video frame parh nahi saka: ${error instanceof Error ? error.message : "video link ki ijazat nahi mili"}`);
      }
    }
    return { frames, duration };
  } finally {
    video.removeAttribute("src");
    video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function isTutorialRequest(command: string): boolean {
  const keywords = ["tutorial", "course", "lesson", "lecture", "summarize", "summary", "samjho", "samajh", "sikhao", "sikhai", "kursus", "dars", "khulasa", "pura video", "full video", "poori video", "kya sikhata", "kya parhata", "topics", "chapters"];
  const lower = command.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export async function captureFullVideoFrames(source: File | string, maxFrames = 8): Promise<{ frames: VideoFrame[]; duration: number }> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  if (typeof source === "string") video.crossOrigin = "anonymous";
  const objectUrl = source instanceof File ? URL.createObjectURL(source) : null;
  const src = typeof source === "string" ? source : objectUrl;
  const waitFor = (event: string) => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("Video load nahi hui.")); }, 30000);
    const ok = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Video frames nahi khul sake.")); };
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, ok); video.removeEventListener("error", fail); };
    video.addEventListener(event, ok, { once: true });
    video.addEventListener("error", fail, { once: true });
  });
  try {
    if (!src) throw new Error("Video file nahi khul saki.");
    video.src = src;
    video.load();
    if (video.readyState < 1) await waitFor("loadedmetadata");
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Video ki lambai nahi parh saki.");
    const count = Math.min(maxFrames, Math.max(4, Math.floor(duration / 15)));
    const interval = duration / (count + 1);
    const times = Array.from({ length: count }, (_, i) => Math.min(duration - 0.5, interval * (i + 1)));
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) throw new Error("Video frames nahi parh sake.");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Video frames nahi parh sake.");
    const frames: VideoFrame[] = [];
    for (const at of times) {
      const seeking = waitFor("seeked");
      video.currentTime = at;
      await seeking;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        frames.push({ at, dataUrl: canvas.toDataURL("image/jpeg", 0.6) });
      } catch {
        // skip frame on error
      }
    }
    return { frames, duration };
  } finally {
    video.removeAttribute("src");
    video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function captureVideoAudio(source: File | string, sceneAt: number): Promise<{ audioDataUrl: string | null }> {
  if (typeof source === "string") {
    return { audioDataUrl: null };
  }
  const video = document.createElement("video");
  video.preload = "auto";
  video.playsInline = true;
  const objectUrl = URL.createObjectURL(source);
  const waitFor = (event: string) => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("Audio load nahi hua.")); }, 20000);
    const ok = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Is video ka audio nahi parh saka.")); };
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, ok); video.removeEventListener("error", fail); };
    video.addEventListener(event, ok, { once: true });
    video.addEventListener("error", fail, { once: true });
  });
  try {
    video.src = objectUrl;
    video.load();
    if (video.readyState < 1) await waitFor("loadedmetadata");
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) return { audioDataUrl: null };
    const start = Math.max(0, sceneAt - 3);
    const end = Math.min(duration, sceneAt + 3);
    const clipDuration = end - start;
    if (clipDuration <= 0) return { audioDataUrl: null };

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();
    const dest = audioCtx.createMediaStreamDestination();
    const sourceNode = audioCtx.createMediaElementSource(video);
    sourceNode.connect(dest);
    sourceNode.connect(audioCtx.destination);

    const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const seekReady = waitFor("seeked");
    video.currentTime = start;
    await seekReady;

    const recordingDone = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start();
    video.muted = false;
    await video.play();
    await new Promise<void>((resolve) => {
      const checkEnd = () => {
        if (video.currentTime >= end || video.ended) {
          video.pause();
          resolve();
        } else {
          requestAnimationFrame(checkEnd);
        }
      };
      checkEnd();
    });
    recorder.stop();
    await recordingDone;
    video.muted = true;
    audioCtx.close();

    if (!chunks.length) return { audioDataUrl: null };
    const blob = new Blob(chunks, { type: "audio/webm" });
    if (blob.size > 500_000) return { audioDataUrl: null };
    const audioDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Audio read nahi ho saka."));
      reader.readAsDataURL(blob);
    });
    return { audioDataUrl };
  } catch {
    return { audioDataUrl: null };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}
