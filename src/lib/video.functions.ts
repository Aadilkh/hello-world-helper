import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

// ---------- shared types ----------

export type ScriptScene = {
  visual: string;
  narration: string;
  durationSeconds: number;
};

export type ClipRow = {
  id: string;
  project_id: string;
  scene_index: number;
  status: string;
  error: string | null;
  resolution: string;
  storage_path: string | null;
  duration_seconds: number;
  url: string | null;
};

// ---------- helpers (server-side only) ----------

function gatewayHeaders(): Record<string, string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI key missing. Lovable AI is not configured.");
  return {
    "Content-Type": "application/json",
    "Lovable-API-Key": key,
    "X-Lovable-AIG-SDK": "fetch",
  };
}

async function readGatewayError(res: Response): Promise<Error> {
  const err = await res.json().catch(() => null);
  const message = (err && (err.message ?? err.error?.message)) || null;
  return new Error(message ?? `AI request failed (${res.status})`);
}

// Streams the Responses API call server-side and returns the final text.
async function callResponses(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({ stream: true, ...body }),
  });
  if (!res.ok || !res.body) throw await readGatewayError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
        text += evt.delta;
      } else if (evt.type === "response.failed") {
        const respErr = (evt.response as Record<string, unknown> | undefined)?.error as
          | Record<string, unknown>
          | undefined;
        throw new Error((respErr?.message as string | undefined) ?? "AI ne script nahi bana saki");
      } else if (evt.type === "error") {
        throw new Error((evt.message as string | undefined) ?? "AI request failed");
      }
    }
  }
  return text;
}

function normalizeScenes(raw: unknown): ScriptScene[] {
  if (!Array.isArray(raw)) return [];
  const scenes: ScriptScene[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const visual = typeof o.visual === "string" ? o.visual : "";
    const narration = typeof o.narration === "string" ? o.narration : "";
    if (!visual) continue;
    const dur = Number(o.durationSeconds ?? o.duration_seconds ?? 8);
    scenes.push({
      visual,
      narration,
      durationSeconds: Math.min(10, Math.max(3, Number.isFinite(dur) ? Math.round(dur) : 8)),
    });
  }
  return scenes.slice(0, 3);
}

// ---------- AI script generation ----------

const GenerateScriptInput = z.object({
  idea: z.string().min(3).max(2000),
  language: z.enum(["urdu", "english"]),
  quality: z.enum(["draft", "hd"]),
  aspectRatio: z.enum(["9:16", "16:9"]),
});

export const generateScript = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenerateScriptInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const langName = data.language === "english" ? "English" : "Urdu";
    const prompt = [
      "You are a short-form video director. Create a script for a 3-scene vertical video.",
      `Video idea from the user: ${data.idea}`,
      "",
      "Rules:",
      "- Exactly 3 scenes.",
      "- 'visual' is a rich, cinematic ENGLISH description of what the camera sees (subject, setting, lighting, camera move). Max 45 words. Describe one continuous shot per scene.",
      "- 'narration' is the spoken line for that scene, written in " + langName + ". Max 18 words per scene.",
      "- 'durationSeconds' is a whole number between 4 and 8.",
      "- The 3 scenes must flow as one story with a strong hook in scene 1 and a payoff in scene 3.",
      "- Title: short and catchy. Hook: one punchy opening line.",
      'Return JSON only, shaped as {"title": string, "hook": string, "scenes": [{"visual": string, "narration": string, "durationSeconds": number}]}',
    ].join("\n");

    const text = await callResponses({
      model: "openai/gpt-6-astra",
      input: prompt,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: {
        format: {
          type: "json_schema",
          name: "video_script",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "hook", "scenes"],
            properties: {
              title: { type: "string" },
              hook: { type: "string" },
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["visual", "narration", "durationSeconds"],
                  properties: {
                    visual: { type: "string" },
                    narration: { type: "string" },
                    durationSeconds: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Script parse nahi ho saki — dobara koshish karein");
    }

    const scenes = normalizeScenes(parsed.scenes);
    if (scenes.length === 0) throw new Error("AI ne empty script di — dobara koshish karein");

    const { data: project, error } = await supabaseAdmin
      .from("video_projects")
      .insert({
        idea: data.idea,
        language: data.language,
        quality: data.quality,
        aspect_ratio: data.aspectRatio,
        title: typeof parsed.title === "string" ? parsed.title : data.idea.slice(0, 80),
        hook: typeof parsed.hook === "string" ? parsed.hook : "",
        scenes,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { project };
  });

// ---------- video job creation ----------

const CreateClipInput = z.object({
  projectId: z.string().uuid(),
  sceneIndex: z.number().int().min(0).max(9),
});

export const createClipJob = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateClipInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: project } = await supabaseAdmin
      .from("video_projects")
      .select("*")
      .eq("id", data.projectId)
      .single();
    if (!project) throw new Error("Project nahi mila");
    const scenes = (project.scenes as unknown) as ScriptScene[];
    const scene = scenes?.[data.sceneIndex];
    if (!scene) throw new Error("Scene nahi mila");

    const { data: existing } = await supabaseAdmin
      .from("video_clips")
      .select("*")
      .eq("project_id", data.projectId)
      .eq("scene_index", data.sceneIndex)
      .maybeSingle();
    if (existing?.status === "in_progress" && existing.job_id) return { clip: existing };
    if (existing?.status === "ready") return { clip: existing };

    const langName = project.language === "english" ? "English" : "Urdu";
    const videoPrompt = [
      scene.visual.trim() + ".",
      `The narrator says in ${langName}: ${scene.narration}`,
      `Audio: a clear ${langName} speaking voice, subtle cinematic ambient music.`,
      "In a single continuous shot, no scene cuts. No captions, no on-screen text.",
    ].join(" ");

    const duration = Math.min(10, Math.max(3, Math.round(scene.durationSeconds || 8)));
    const resolution = project.quality === "hd" ? "720p" : "360p";

    // Upsert the clip row first so a failed create is visible as failed.
    let clip = existing;
    if (!clip) {
      const { data: created, error } = await supabaseAdmin
        .from("video_clips")
        .insert({
          project_id: data.projectId,
          scene_index: data.sceneIndex,
          prompt: videoPrompt,
          duration_seconds: duration,
          resolution,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      clip = created;
    }

    const res = await fetch(`${GATEWAY}/videos`, {
      method: "POST",
      headers: gatewayHeaders(),
      body: JSON.stringify({
        model: "google/gemini-omni-1.1-flash",
        input: videoPrompt,
        response_format: {
          type: "video",
          resolution,
          duration: `${duration}s`,
          aspect_ratio: project.aspect_ratio,
        },
      }),
    });

    if (!res.ok) {
      const err = await readGatewayError(res);
      await supabaseAdmin
        .from("video_clips")
        .update({ status: "failed", error: err.message })
        .eq("id", clip.id);
      throw err;
    }

    const job = (await res.json()) as { id?: string };
    if (!job.id) throw new Error("Video job start nahi hua");

    const { data: updated, error } = await supabaseAdmin
      .from("video_clips")
      .update({ job_id: job.id, status: "in_progress", error: null })
      .eq("id", clip.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { clip: updated };
  });

// ---------- project reads (also syncs in-flight video jobs) ----------

const GetProjectInput = z.object({ projectId: z.string().uuid() });

async function syncClip(clip: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (clip.status !== "in_progress" || !clip.job_id) return clip;
  const res = await fetch(`${GATEWAY}/videos/${clip.job_id}`, {
    headers: gatewayHeaders(),
  });
  if (!res.ok) return clip; // transient — try again on next poll
  const job = (await res.json()) as {
    status?: string;
    error?: { code?: string; message?: string };
  };

  if (job.status === "completed") {
    const videoRes = await fetch(`${GATEWAY}/videos/${clip.job_id}/content`, {
      headers: gatewayHeaders(),
    });
    if (videoRes.ok) {
      const bytes = new Uint8Array(await videoRes.arrayBuffer());
      const path = `clips/${clip.id}.mp4`;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage
        .from("generated-videos")
        .upload(path, bytes, { contentType: "video/mp4", upsert: true });
      const { data: updated } = await supabaseAdmin
        .from("video_clips")
        .update({ status: "ready", storage_path: path, error: null })
        .eq("id", clip.id as string)
        .select("*")
        .single();
      return updated ?? clip;
    }
    return clip;
  }

  if (job.status === "failed") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const msg = job.error?.message ?? "Video generation failed";
    const { data: updated } = await supabaseAdmin
      .from("video_clips")
      .update({ status: "failed", error: msg })
      .eq("id", clip.id as string)
      .select("*")
      .single();
    return updated ?? clip;
  }
  return clip;
}

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetProjectInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: project } = await supabaseAdmin
      .from("video_projects")
      .select("*")
      .eq("id", data.projectId)
      .single();
    if (!project) throw new Error("Project nahi mila");

    const { data: clips } = await supabaseAdmin
      .from("video_clips")
      .select("*")
      .eq("project_id", data.projectId)
      .order("scene_index", { ascending: true });

    const synced = [];
    for (const clip of clips ?? []) {
      synced.push(await syncClip(clip as Record<string, unknown>));
    }

    // Sign URLs for ready clips
    const result: ClipRow[] = [];
    for (const clip of synced) {
      let url: string | null = null;
      const storagePath = clip.storage_path as string | null;
      if (clip.status === "ready" && storagePath) {
        const { data: signed } = await supabaseAdmin.storage
          .from("generated-videos")
          .createSignedUrl(storagePath, 604800);
        url = signed?.signedUrl ?? null;
      }
      result.push({
        id: clip.id as string,
        project_id: clip.project_id as string,
        scene_index: clip.scene_index as number,
        status: clip.status as string,
        error: (clip.error as string | null) ?? null,
        resolution: clip.resolution as string,
        storage_path: storagePath,
        duration_seconds: clip.duration_seconds as number,
        url,
      });
    }

    return { project, clips: result };
  });

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: projects } = await supabaseAdmin
    .from("video_projects")
    .select("id, idea, title, language, quality, aspect_ratio, created_at")
    .order("created_at", { ascending: false })
    .limit(12);
  if (!projects || projects.length === 0) return { projects: [] };

  const ids = projects.map((p) => p.id as string);
  const { data: clips } = await supabaseAdmin
    .from("video_clips")
    .select("project_id, status")
    .in("project_id", ids);

  const counts = new Map<string, { total: number; ready: number }>();
  for (const c of clips ?? []) {
    const entry = counts.get(c.project_id) ?? { total: 0, ready: 0 };
    entry.total += 1;
    if (c.status === "ready") entry.ready += 1;
    counts.set(c.project_id, entry);
  }

  return {
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title ?? p.idea,
      idea: p.idea,
      quality: p.quality,
      aspect_ratio: p.aspect_ratio,
      language: p.language,
      createdAt: p.created_at,
      ...counts.get(p.id as string),
    })),
  };
});
