export type VideoFrame = { at: number; dataUrl: string };

export function parseSceneTime(command: string): number | null {
  const words = command.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?\.?|منٹ)\s*(\d{1,2})\s*(?:sec(?:ond)?s?\.?|سیکنڈ)?\b/i);
  if (words) return Number(words[1]) * 60 + Number(words[2]);
  const clock = command.match(/\b(\d{1,3}):(\d{2})\b/);
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
  const src = objectUrl ?? source;
  const waitFor = (event: string) => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("Video load nahi hui. MP4 file share karein ya direct public video link dein.")); }, 20000);
    const ok = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Video link par frames dekhne ki ijazat nahi mili. Video file upload karein.")); };
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, ok); video.removeEventListener("error", fail); };
    video.addEventListener(event, ok, { once: true });
    video.addEventListener("error", fail, { once: true });
  });
  try {
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
      } catch {
        throw new Error("Is link ki video ko site ne dekhne se roka hai. Video file upload karein.");
      }
    }
    return { frames, duration };
  } finally {
    video.removeAttribute("src");
    video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}