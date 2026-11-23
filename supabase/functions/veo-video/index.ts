const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RequestBody = {
  action?: "start" | "poll";
  apiKey?: string;
  model?: "veo-3.1-generate-001" | "veo-3.1-fast-generate-001";
  prompt?: string;
  aspectRatio?: "9:16" | "16:9";
  durationSeconds?: 4 | 6 | 8;
  resolution?: "720p" | "1080p";
  imageDataUrl?: string | null;
  operationName?: string;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = (await request.json()) as RequestBody;
    const apiKey = body.apiKey?.trim();
    if (!apiKey || apiKey.length < 20) return json({ error: "Google API key zaroori hai" }, 400);

    if (body.action === "start") {
      if (!body.model || !body.prompt) return json({ error: "Veo model aur prompt zaroori hain" }, 400);
      const image = parseImage(body.imageDataUrl);
      const instance: Record<string, unknown> = { prompt: body.prompt };
      if (image) instance.image = image;
      const response = await fetch(
        `https://aiplatform.googleapis.com/v1/publishers/google/models/${body.model}:predictLongRunning?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            instances: [instance],
            parameters: {
              aspectRatio: body.aspectRatio === "16:9" ? "16:9" : "9:16",
              durationSeconds: String(body.durationSeconds ?? 8),
              resolution: body.resolution === "1080p" ? "1080p" : "720p",
              sampleCount: 1,
            },
          }),
        },
      );
      const result = await response.json().catch(() => null) as { name?: string; error?: { message?: string } } | null;
      if (!response.ok || !result?.name) return json({ error: result?.error?.message ?? "Veo job start nahi hua" }, response.status || 502);
      return json({ operationName: result.name });
    }

    if (body.action === "poll") {
      if (!body.operationName) return json({ error: "Veo operation nahi mili" }, 400);
      const response = await fetch(`https://aiplatform.googleapis.com/v1/${body.operationName}?key=${encodeURIComponent(apiKey)}`, {
        headers: { "x-goog-api-key": apiKey },
      });
      const result = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok) return json({ error: readError(result) }, response.status || 502);
      if (!result?.done) return json({ done: false, progress: 55 });
      if (result.error) return json({ error: readError(result.error) }, 502);
      const videoBase64 = findVideoBase64(result);
      return json({ done: true, videoBase64 });
    }

    return json({ error: "Unknown Veo action" }, 400);
  } catch (error) {
    console.error("veo-video failed", error);
    return json({ error: "Veo service abhi available nahi hai" }, 500);
  }
});

function parseImage(dataUrl: string | null | undefined): { bytesBase64Encoded: string; mimeType: string } | null {
  if (!dataUrl) return null;
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Sirf PNG, JPG ya WEBP image supported hai");
  return { bytesBase64Encoded: match[2]!, mimeType: match[1]!.toLowerCase() };
}

function findVideoBase64(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoBase64(item);
      if (found) return found;
    }
    return undefined;
  }
  const object = value as Record<string, unknown>;
  for (const key of ["bytesBase64Encoded", "videoBytes", "video_base64"]) {
    if (typeof object[key] === "string") return object[key] as string;
  }
  for (const child of Object.values(object)) {
    const found = findVideoBase64(child);
    if (found) return found;
  }
  return undefined;
}

function readError(value: unknown): string {
  if (!value || typeof value !== "object") return "Google Veo request fail hui";
  const message = (value as { message?: unknown }).message;
  return typeof message === "string" ? message : "Google Veo request fail hui";
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
