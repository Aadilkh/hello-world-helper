import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { geminiJson } from "@/lib/gemini";

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
  progress: number;
  started_at: string | null;
  url: string | null;
  mode: string | null;
};

// ---------- AI script generation (Gemini) ----------

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

    const parsed = await geminiJson<{
      title: string;
      hook: string;
      scenes: ScriptScene[];
    }>(prompt, {
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
    });

    const scenes = normalizeScenes(parsed.scenes);
    if (scenes.length === 0) throw new Error("AI ne empty script di — dobara koshish karein");

    const { data: project, error } = await supabaseAdmin
      .from("video_projects")
      .insert({
        idea: data.idea,
        language: data.language,
        quality: data.quality,
        aspect_ratio: data.aspectRatio,
        title: parsed.title || data.idea.slice(0, 80),
        hook: parsed.hook ?? "",
        scenes,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { project };
  });

function normalizeScenes(raw: unknown): ScriptScene[] {
  if (!Array.isArray(raw)) return [];
  const scenes: ScriptScene[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const visual = typeof o["visual"] === "string" ? o["visual"] : "";
    const narration = typeof o["narration"] === "string" ? o["narration"] : "";
    if (!visual) continue;
    const dur = Number(o["durationSeconds"] ?? o["duration_seconds"] ?? 8);
    scenes.push({
      visual,
      narration,
      durationSeconds: Math.min(10, Math.max(3, Number.isFinite(dur) ? Math.round(dur) : 8)),
    });
  }
  return scenes.slice(0, 3);
}

// ---------- video clip creation ----------

const CreateClipInput = z.object({
  projectId: z.string().uuid(),
  sceneIndex: z.number().int().min(0).max(9),
  resolution: z.enum(["360p", "720p", "1080p"]).optional(),
  durationSeconds: z.number().int().min(3).max(10).optional(),
  mode: z.enum(["veo", "free"]).optional().default("free"),
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

    const rawLang = (project.language ?? "urdu").trim();
    const langName =
      rawLang.toLowerCase() === "urdu"
        ? "Urdu"
        : rawLang.toLowerCase() === "english"
          ? "English"
          : rawLang.charAt(0).toUpperCase() + rawLang.slice(1);

    const duration = Math.min(
      10,
      Math.max(3, Math.round(data.durationSeconds ?? scene.durationSeconds ?? 8)),
    );
    const resolution = data.resolution ?? (project.quality === "hd" ? "720p" : "360p");

    let clip = existing;
    if (!clip) {
      const { data: created, error } = await supabaseAdmin
        .from("video_clips")
        .insert({
          project_id: data.projectId,
          scene_index: data.sceneIndex,
          prompt: scene.visual,
          duration_seconds: duration,
          resolution,
          status: "pending",
          progress: 0,
          mode: data.mode,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      clip = created;
    } else {
      await supabaseAdmin
        .from("video_clips")
        .update({ duration_seconds: duration, resolution, mode: data.mode })
        .eq("id", clip.id);
    }

    if (data.mode === "veo") {
      throw new Error("Veo video generation abhi setup nahi hai. Free Mode use karein.");
    }

    // ---- Free Mode: stock photo search + TTS narration ----
    const { data: updated, error: upErr } = await supabaseAdmin
      .from("video_clips")
      .update({ status: "in_progress", progress: 10, started_at: new Date().toISOString() })
      .eq("id", clip.id)
      .select("*")
      .single();
    if (upErr) throw new Error(upErr.message);

    const stockPhotos = await searchStockPhotos(scene.visual, 3);
    const audioBase64 = await synthesizeTTS(scene.narration, langName);

    const path = `clips/${clip.id}.json`;
    const clipData = {
      photos: stockPhotos,
      audioBase64,
      narration: scene.narration,
      duration,
      aspectRatio: project.aspect_ratio,
    };
    const { error: storeErr } = await supabaseAdmin.storage
      .from("generated-videos")
      .upload(path, JSON.stringify(clipData), { contentType: "application/json", upsert: true });
    if (storeErr) throw new Error(storeErr.message);

    const { data: finalClip } = await supabaseAdmin
      .from("video_clips")
      .update({ status: "ready", storage_path: path, error: null, progress: 100 })
      .eq("id", clip.id)
      .select("*")
      .single();

    return { clip: finalClip ?? updated };
  });

async function searchStockPhotos(query: string, count: number): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${process.env["GEMINI_API_KEY"]}&cx=${process.env["GOOGLE_CSE_ID"] ?? ""}&q=${encodeURIComponent(query)}&searchType=image&num=${count}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: Array<{ link?: string }> };
    return (data.items ?? []).map((i) => i.link ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

async function synthesizeTTS(text: string, langName: string): Promise<string | null> {
  try {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) return null;
    const langMap: Record<string, string> = {
      Urdu: "ur-PK",
      English: "en-US",
      Japanese: "ja-JP",
      Hindi: "hi-IN",
      Arabic: "ar-SA",
      Spanish: "es-ES",
      French: "fr-FR",
      German: "de-DE",
    };
    const langCode = langMap[langName] ?? "en-US";
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: langCode, ssmlGender: "NEUTRAL" },
          audioConfig: { audioEncoding: "MP3" },
        }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { audioContent?: string };
    return data.audioContent ?? null;
  } catch {
    return null;
  }
}

// ---------- project reads ----------

const GetProjectInput = z.object({ projectId: z.string().uuid() });

type DbClip = {
  id: string;
  project_id: string;
  scene_index: number;
  prompt: string;
  duration_seconds: number;
  job_id: string | null;
  status: string;
  error: string | null;
  resolution: string;
  storage_path: string | null;
  progress: number;
  started_at: string | null;
  mode: string | null;
};

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

    const result: ClipRow[] = [];
    for (const clip of clips ?? []) {
      const c = clip as unknown as DbClip;
      let url: string | null = null;
      const storagePath = c.storage_path as string | null;
      if (c.status === "ready" && storagePath) {
        const { data: signed } = await supabaseAdmin.storage
          .from("generated-videos")
          .createSignedUrl(storagePath, 604800);
        url = signed?.signedUrl ?? null;
      }
      result.push({
        id: c.id,
        project_id: c.project_id,
        scene_index: c.scene_index,
        status: c.status,
        error: c.error ?? null,
        resolution: c.resolution,
        storage_path: storagePath,
        duration_seconds: c.duration_seconds,
        progress: c.progress ?? 0,
        started_at: c.started_at ?? null,
        url,
        mode: c.mode ?? null,
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
