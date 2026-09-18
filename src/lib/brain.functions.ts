import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export type SearchHit = { title: string; url: string; snippet: string };

export type Evidence = { title: string; url: string; note: string };

export type Monetization = {
  verdict: string;
  rpmNote: string;
  rules: string[];
  avoid: string[];
};

export type PlanResult = {
  reply: string;
  projectId: string;
  evidence: Evidence[];
  monetization: Monetization;
  platform: string;
  audience: string;
  niche: string;
};

// ---------- gateway helpers ----------

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
  const err = (await res.json().catch(() => null)) as
    | { message?: string; error?: { message?: string } }
    | null;
  const message = err?.message ?? err?.error?.message ?? null;
  return new Error(message ?? `AI request failed (${res.status})`);
}

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
      if (evt["type"] === "response.output_text.delta" && typeof evt["delta"] === "string") {
        text += evt["delta"];
      } else if (evt["type"] === "response.failed") {
        const respErr = (evt["response"] as Record<string, unknown> | undefined)?.["error"] as
          | Record<string, unknown>
          | undefined;
        throw new Error((respErr?.["message"] as string | undefined) ?? "AI request failed");
      } else if (evt["type"] === "error") {
        throw new Error((evt["message"] as string | undefined) ?? "AI request failed");
      }
    }
  }
  return text;
}

async function callJson<T>(body: Record<string, unknown>): Promise<T> {
  const text = await callResponses(body);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI ka jawab parse nahi ho saka — dobara koshish karein");
  }
}

// ---------- web research ----------

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function webSearch(query: string, limit = 4): Promise<SearchHit[]> {
  try {
    const res = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      body: new URLSearchParams({ q: query }).toString(),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const links: Array<{ url: string; title: string }> = [];
    const linkRe = /href="([^"]+)"\s+class='result-link'>([\s\S]*?)<\/a>/g;
    for (let m = linkRe.exec(html); m; m = linkRe.exec(html)) {
      links.push({ url: m[1] ?? "", title: stripHtml(m[2] ?? "") });
    }
    const snippets: string[] = [];
    const snipRe = /<td class='result-snippet'>([\s\S]*?)<\/td>/g;
    for (let m = snipRe.exec(html); m; m = snipRe.exec(html)) {
      snippets.push(stripHtml(m[1] ?? ""));
    }

    return links.slice(0, limit).map((l, i) => ({
      title: l.title,
      url: l.url,
      snippet: (snippets[i] ?? "").slice(0, 500),
    }));
  } catch {
    return [];
  }
}

// ---------- reference image upload ----------

const UploadRefInput = z.object({
  dataUrl: z.string().min(32).max(9_000_000),
  fileName: z.string().max(200).optional(),
});

export const uploadReference = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UploadRefInput.parse(input))
  .handler(async ({ data }) => {
    const match = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i.exec(data.dataUrl);
    if (!match) throw new Error("Sirf PNG, JPG ya WEBP photo chalti hai");
    const mime = match[1]!.toLowerCase();
    const base64 = match[3]!;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 6_000_000) throw new Error("Photo 6MB se chhoti honi chahiye");

    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const path = `refs/${crypto.randomUUID()}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("generated-videos")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (error) throw new Error(error.message);
    return { path };
  });

// ---------- the research brain ----------

const PlanInput = z.object({
  command: z.string().min(3).max(4000),
  platform: z
    .enum(["auto", "youtube", "tiktok", "instagram", "facebook", "x"])
    .optional()
    .default("auto"),
  quality: z.enum(["draft", "hd"]).optional().default("draft"),
  refPaths: z.array(z.string().max(300)).max(3).optional().default([]),
  voiceNote: z.string().max(500).optional().default(""),
});

type Meta = {
  replyLanguage: string;
  narrationLanguage: string;
  platform: string;
  audience: string;
  niche: string;
  searchQueries: string[];
};

type Plan = {
  reply: string;
  title: string;
  hook: string;
  aspectRatio: "9:16" | "16:9";
  monetization: Monetization;
  evidence: Evidence[];
  scenes: Array<{ visual: string; narration: string; durationSeconds: number }>;
};

export const researchAndPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PlanInput.parse(input))
  .handler(async ({ data }): Promise<PlanResult> => {
    // --- Step 1: understand the command, pick research queries ---
    const meta = await callJson<Meta>({
      model: "openai/gpt-6-astra",
      input: [
        "You are the planning brain of a monetization-first video studio.",
        "Read the user's command (it may be in Roman Urdu, Urdu, English, Japanese or any language) and decide the targets.",
        data.platform === "auto" ? "" : `The user forced platform: ${data.platform}.`,
        "",
        `User command: ${data.command}`,
        "",
        "replyLanguage: the language the user wrote in (e.g. 'Roman Urdu', 'English', 'Japanese').",
        "narrationLanguage: the language the video's spoken narration must be in for the TARGET audience (e.g. Japanese audience -> 'Japanese', USA/UK travel audience -> 'English').",
        "audience: the country/region of the paying audience. niche: the content niche.",
        "searchQueries: exactly 3 web search queries, in the best language for that research, that gather (1) what top existing videos/blogs in this niche+language already say, (2) the platform's current monetization rules for this content type, (3) what pays well (RPM/CPM/advertiser demand) in this niche and country.",
      ]
        .filter(Boolean)
        .join("\n"),
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: {
        format: {
          type: "json_schema",
          name: "plan_meta",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "replyLanguage",
              "narrationLanguage",
              "platform",
              "audience",
              "niche",
              "searchQueries",
            ],
            properties: {
              replyLanguage: { type: "string" },
              narrationLanguage: { type: "string" },
              platform: { type: "string", enum: ["youtube", "tiktok", "instagram", "facebook", "x"] },
              audience: { type: "string" },
              niche: { type: "string" },
              searchQueries: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    });

    const platform = data.platform === "auto" ? meta.platform : data.platform;

    // --- Step 2: research the web ---
    const queries = (meta.searchQueries ?? []).slice(0, 3);
    const hitGroups = await Promise.all(queries.map((q) => webSearch(q)));
    const hits: SearchHit[] = hitGroups.flat();
    const researchBlock =
      hits.length > 0
        ? hits
            .map((h, i) => `[${i + 1}] ${h.title}\nURL: ${h.url}\n${h.snippet}`)
            .join("\n\n")
        : "(no web results available — rely on your own knowledge and say so)";

    // --- Step 3: monetization-first plan + script ---
    const plan = await callJson<Plan>({
      model: "openai/gpt-6-astra",
      input: [
        "You are 'Vision Pilot Dev Master' — a monetization-first video director and researcher.",
        "",
        `User command: ${data.command}`,
        `Target platform: ${platform}. Audience: ${meta.audience}. Niche: ${meta.niche}.`,
        `Narration language must be: ${meta.narrationLanguage}.`,
        data.voiceNote ? `Voice/tone the user wants: ${data.voiceNote}` : "",
        data.refPaths.length > 0
          ? `The user attached ${data.refPaths.length} reference photo(s); the first scene should match their look.`
          : "",
        "",
        "Web research findings (use as evidence, cite the URLs you actually used):",
        researchBlock,
        "",
        "Rules:",
        "- Money first: only propose content that can actually earn (advertiser-friendly, high RPM niche/country, platform-monetizable format). If the user's idea earns views but no money, say so in `reply` and steer it to a version that pays.",
        "- Respect platform policy: no reused/unoriginal content, no copyrighted footage or music, no misleading claims, nothing in a demonetized category.",
        "- Exactly 3 scenes. `visual` is a rich cinematic ENGLISH shot description (subject, setting, lighting, camera move), max 45 words, one continuous shot. `narration` is the spoken line in " +
          meta.narrationLanguage +
          ", max 18 words. `durationSeconds` is a whole number 4-8.",
        "- aspectRatio: '9:16' for TikTok/Reels/Shorts/X short, '16:9' for long-form YouTube/Facebook.",
        "- monetization.verdict: one line on whether this earns and why. rpmNote: what advertisers pay in this niche/country per the research. rules: 3-5 concrete platform rules this plan follows. avoid: 3-5 things that would kill the earning.",
        "- evidence: 3-6 items, each a real URL from the research above with a short note on what it proves.",
        `- reply: speak to the user in ${meta.replyLanguage}, 3-6 short sentences: what you researched, why this version earns, and what to do next. No markdown headings.`,
        "Return JSON only.",
      ]
        .filter(Boolean)
        .join("\n"),
      reasoning: { effort: "medium", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: {
        format: {
          type: "json_schema",
          name: "content_plan",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["reply", "title", "hook", "aspectRatio", "monetization", "evidence", "scenes"],
            properties: {
              reply: { type: "string" },
              title: { type: "string" },
              hook: { type: "string" },
              aspectRatio: { type: "string", enum: ["9:16", "16:9"] },
              monetization: {
                type: "object",
                additionalProperties: false,
                required: ["verdict", "rpmNote", "rules", "avoid"],
                properties: {
                  verdict: { type: "string" },
                  rpmNote: { type: "string" },
                  rules: { type: "array", items: { type: "string" } },
                  avoid: { type: "array", items: { type: "string" } },
                },
              },
              evidence: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "url", "note"],
                  properties: {
                    title: { type: "string" },
                    url: { type: "string" },
                    note: { type: "string" },
                  },
                },
              },
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

    const scenes = (plan.scenes ?? [])
      .filter((s) => s && typeof s.visual === "string" && s.visual.trim().length > 0)
      .slice(0, 3)
      .map((s) => ({
        visual: s.visual,
        narration: typeof s.narration === "string" ? s.narration : "",
        durationSeconds: Math.min(10, Math.max(3, Math.round(Number(s.durationSeconds) || 8))),
      }));
    if (scenes.length === 0) throw new Error("AI ne khali plan diya — dobara koshish karein");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: project, error } = await supabaseAdmin
      .from("video_projects")
      .insert({
        idea: data.command,
        command: data.command,
        language: meta.narrationLanguage,
        quality: data.quality,
        aspect_ratio: plan.aspectRatio,
        title: plan.title || data.command.slice(0, 80),
        hook: plan.hook ?? "",
        scenes,
        platform,
        audience: meta.audience,
        niche: meta.niche,
        monetization: plan.monetization,
        research: plan.evidence ?? [],
        ref_image_paths: data.refPaths,
        voice_note: data.voiceNote,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return {
      reply: plan.reply,
      projectId: project.id as string,
      evidence: plan.evidence ?? [],
      monetization: plan.monetization,
      platform,
      audience: meta.audience,
      niche: meta.niche,
    };
  });
