import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const VeoInput = z.object({
  projectId: z.string().uuid(),
  sceneIndex: z.number().int().min(0).max(9),
  apiKey: z.string().min(20).max(300),
  model: z.enum(["veo-3.1-generate-001", "veo-3.1-fast-generate-001"]),
  imageDataUrl: z.string().max(30_000_000).optional().nullable(),
});

const PollInput = z.object({
  projectId: z.string().uuid(),
  clipId: z.string().uuid(),
  operationName: z.string().min(1).max(2000),
  apiKey: z.string().min(20).max(300),
});

export type VeoClip = {
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
  url: string | null;
  mode: string | null;
};

export const startVeoClip = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VeoInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: project, error: projectError } = await supabaseAdmin
      .from("video_projects")
      .select("id, aspect_ratio, quality, scenes")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projectError || !project) throw new Error("Project nahi mila");

    const scenes = Array.isArray(project.scenes) ? project.scenes : [];
    const scene = scenes[data.sceneIndex] as { visual?: string; narration?: string; durationSeconds?: number } | undefined;
    if (!scene?.visual) throw new Error("Scene nahi mila");

    const duration = scene.durationSeconds === 4 || scene.durationSeconds === 6 ? scene.durationSeconds : 8;
    const resolution = project.quality === "hd" ? "1080p" : "720p";
    const { data: existing } = await supabaseAdmin
      .from("video_clips")
      .select("*")
      .eq("project_id", data.projectId)
      .eq("scene_index", data.sceneIndex)
      .maybeSingle();

    let clip = existing;
    if (clip?.status === "ready") return { clip: await withSignedUrl(supabaseAdmin, clip) };

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
          mode: "veo",
        })
        .select("*")
        .single();
      if (error || !created) throw new Error("Clip record nahi ban saka");
      clip = created;
    }

    const response = await callVeoEdgeFunction({
      action: "start",
      apiKey: data.apiKey,
      model: data.model,
      prompt: `${scene.visual}${scene.narration ? ` Spoken dialogue or narration: ${scene.narration}` : ""}`,
      aspectRatio: project.aspect_ratio === "16:9" ? "16:9" : "9:16",
      durationSeconds: duration,
      resolution,
      imageDataUrl: data.imageDataUrl ?? null,
    });

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("video_clips")
      .update({
        status: "in_progress",
        progress: 12,
        started_at: new Date().toISOString(),
        job_id: response.operationName,
        error: null,
        mode: "veo",
      })
      .eq("id", clip.id)
      .select("*")
      .single();
    if (updateError || !updated) throw new Error("Veo job save nahi ho saka");
    return { clip: await withSignedUrl(supabaseAdmin, updated), operationName: response.operationName };
  });

export const pollVeoClip = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PollInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clip, error: clipError } = await supabaseAdmin
      .from("video_clips")
      .select("*")
      .eq("id", data.clipId)
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (clipError || !clip) throw new Error("Clip nahi mila");

    const result = await callVeoEdgeFunction({
      action: "poll",
      apiKey: data.apiKey,
      operationName: data.operationName,
    });
    if (!result.done) {
      const progress = Math.min(95, Math.max(15, Number(result.progress ?? 40)));
      const { data: updated } = await supabaseAdmin
        .from("video_clips")
        .update({ status: "in_progress", progress })
        .eq("id", data.clipId)
        .select("*")
        .single();
      return { done: false, clip: await withSignedUrl(supabaseAdmin, updated ?? clip) };
    }

    if (!result.videoBase64) {
      const message = "Veo ne video file return nahi ki";
      await supabaseAdmin.from("video_clips").update({ status: "failed", error: message, progress: 0 }).eq("id", data.clipId);
      throw new Error(message);
    }

    const bytes = Uint8Array.from(atob(result.videoBase64), (character) => character.charCodeAt(0));
    const storagePath = `veo-clips/${data.clipId}.mp4`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("generated-videos")
      .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
    if (uploadError) throw new Error("Generated video save nahi ho saki");

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("video_clips")
      .update({ status: "ready", progress: 100, storage_path: storagePath, error: null })
      .eq("id", data.clipId)
      .select("*")
      .single();
    if (updateError || !updated) throw new Error("Generated video record update nahi hua");
    return { done: true, clip: await withSignedUrl(supabaseAdmin, updated) };
  });

async function withSignedUrl(supabaseAdmin: SupabaseClient<Database>, clip: Record<string, unknown>) {
  const storagePath = typeof clip.storage_path === "string" ? clip.storage_path : null;
  let url: string | null = null;
  if (storagePath && clip.status === "ready") {
    const { data } = await supabaseAdmin.storage.from("generated-videos").createSignedUrl(storagePath, 3600);
    url = data?.signedUrl ?? null;
  }
  return { ...clip, url } as VeoClip;
}

async function callVeoEdgeFunction(input: Record<string, unknown>): Promise<{ operationName?: string; done?: boolean; progress?: number; videoBase64?: string }> {
  const baseUrl = process.env["SUPABASE_URL"];
  const anonKey = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!baseUrl || !anonKey) throw new Error("Veo service available nahi hai");
  const response = await fetch(`${baseUrl}/functions/v1/veo-video`, {
    method: "POST",
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => null)) as { error?: string } & Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Veo request fail hui");
  return body;
}
