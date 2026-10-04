import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// VisionPilot Cell 8 — Autonomous Development Engine (web version)
// Flow: capability_audit → discover_gap → research_request → develop → validate → register.
// Legacy protection: core capabilities are read-only (never modified, deleted, or recreated).

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export type Capability = {
  id: string;
  name: string;
  description: string;
  domain: string;
  instructions: string;
  keywords: string[];
  status: string;
  validated: boolean;
  is_core: boolean;
  sha256: string | null;
  evidence: Array<{ title: string; url: string }>;
  created_at: string;
};

export type Step = { step: string; status: "PASS" | "FAIL" | "SKIP"; detail: string };

export type UpgradeResult = {
  status: "AUTONOMOUS_DEVELOPMENT_PASS" | "AUTONOMOUS_DEVELOPMENT_FAIL" | "ALREADY_CAPABLE";
  steps: Step[];
  capability: Capability | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Db;
}

async function aiJson<T>(input: string, name: string, schema: Record<string, unknown>): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI key missing");
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      input,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const e = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
    throw new Error(e?.message ?? e?.error?.message ?? `AI request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const p = t.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      try {
        const evt = JSON.parse(p) as Record<string, unknown>;
        if (evt["type"] === "response.output_text.delta" && typeof evt["delta"] === "string") text += evt["delta"];
        if (evt["type"] === "response.failed" || evt["type"] === "error") throw new Error("AI request failed");
      } catch (err) {
        if (err instanceof Error && err.message === "AI request failed") throw err;
      }
    }
  }
  return JSON.parse(text) as T;
}

async function webSearch(q: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const res = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      body: new URLSearchParams({ q }).toString(),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const strip = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const links: Array<{ url: string; title: string }> = [];
    const lr = /href="([^"]+)"\s+class='result-link'>([\s\S]*?)<\/a>/g;
    for (let m = lr.exec(html); m; m = lr.exec(html)) links.push({ url: m[1] ?? "", title: strip(m[2] ?? "") });
    const sn: string[] = [];
    const sr = /<td class='result-snippet'>([\s\S]*?)<\/td>/g;
    for (let m = sr.exec(html); m; m = sr.exec(html)) sn.push(strip(m[1] ?? ""));
    return links.slice(0, 5).map((l, i) => ({ ...l, snippet: (sn[i] ?? "").slice(0, 400) }));
  } catch {
    return [];
  }
}

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const listCapabilities = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  const { data, error } = await sb.from("capabilities").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { capabilities: (data ?? []) as Capability[] };
});

export const runAutonomousDevelopment = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ requirement: z.string().min(5).max(1000) }).parse(i))
  .handler(async ({ data }): Promise<UpgradeResult> => {
    const sb = await db();
    const steps: Step[] = [];
    const finish = async (status: UpgradeResult["status"], capability: Capability | null) => {
      await sb.from("upgrade_runs").insert({ requirement: data.requirement, status, steps, capability_id: capability?.id ?? null });
      return { status, steps, capability };
    };

    // 1. Capability audit
    const { data: caps, error } = await sb.from("capabilities").select("*");
    if (error) throw new Error(error.message);
    const all = (caps ?? []) as Capability[];
    const active = all.filter((c) => c.status === "ACTIVE");
    steps.push({ step: "Capability audit", status: "PASS", detail: `${all.length} salahiyatein, ${active.length} active` });

    // 2. Gap discovery
    const gap = await aiJson<{ covered: boolean; coveredBy: string; gap: string; searchQuery: string }>(
      [
        "You are the gap-discovery module of VisionPilot, an AI video content studio.",
        "Existing capabilities:",
        ...active.map((c) => `- ${c.name}: ${c.description}`),
        `New requirement: ${data.requirement}`,
        "covered: true only if an existing capability fully handles it (coveredBy = its name). Otherwise describe the missing gap in one line and give one English web search query to research how to do it well.",
      ].join("\n"),
      "gap",
      {
        type: "object",
        additionalProperties: false,
        required: ["covered", "coveredBy", "gap", "searchQuery"],
        properties: { covered: { type: "boolean" }, coveredBy: { type: "string" }, gap: { type: "string" }, searchQuery: { type: "string" } },
      },
    );
    if (gap.covered) {
      steps.push({ step: "Gap discovery", status: "PASS", detail: `Pehle se maujood: ${gap.coveredBy}` });
      return finish("ALREADY_CAPABLE", all.find((c) => c.name === gap.coveredBy) ?? null);
    }
    steps.push({ step: "Gap discovery", status: "PASS", detail: gap.gap });

    // 3. Research request
    const hits = await webSearch(gap.searchQuery);
    steps.push({
      step: "Research",
      status: hits.length ? "PASS" : "SKIP",
      detail: hits.length ? `${hits.length} sources mile` : "Web results nahi mile — AI ki apni maloomat",
    });

    // 4. Development (isolated: produces a capability spec, never touches core ones)
    const dev = await aiJson<{ name: string; description: string; domain: string; instructions: string; keywords: string[] }>(
      [
        "Develop a new capability for VisionPilot's video planning brain to close this gap.",
        `Gap: ${gap.gap}`,
        `Requirement: ${data.requirement}`,
        "Research:",
        ...hits.map((h, i) => `[${i + 1}] ${h.title} — ${h.url}\n${h.snippet}`),
        "name: snake_case, unique, not one of: " + all.map((c) => c.name).join(", "),
        "description: one short line in Roman Urdu.",
        "domain: one of research, development, multimodal, monetization, platform, language.",
        "instructions: 4-8 concrete, policy-safe rules (English) the brain must follow when planning a video that needs this capability. No harmful, deceptive, or copyright-violating rules.",
        "keywords: 3-8 lowercase trigger words (any language) that indicate a command needs this.",
      ].join("\n"),
      "capability",
      {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "domain", "instructions", "keywords"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          domain: { type: "string" },
          instructions: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
        },
      },
    );
    steps.push({ step: "Development", status: "PASS", detail: `Nayi salahiyat tayyar: ${dev.name}` });

    // 5. Validation (structural + protection + AI safety review)
    const name = dev.name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 60);
    const problems: string[] = [];
    if (!name) problems.push("naam khali");
    if (all.some((c) => c.name === name)) problems.push("naam pehle se maujood (legacy protection)");
    if (dev.instructions.trim().length < 40) problems.push("hidayat bohot chhoti");
    if (dev.keywords.length === 0) problems.push("keywords nahi");
    const review = await aiJson<{ safe: boolean; reason: string }>(
      `Review this capability for a public video studio. safe=false if it encourages misleading claims, copyright violation, platform-policy breaking, spam, or harm.\n${dev.instructions}`,
      "review",
      { type: "object", additionalProperties: false, required: ["safe", "reason"], properties: { safe: { type: "boolean" }, reason: { type: "string" } } },
    );
    if (!review.safe) problems.push(`safety: ${review.reason}`);
    if (problems.length) {
      steps.push({ step: "Validation", status: "FAIL", detail: problems.join("; ") });
      return finish("AUTONOMOUS_DEVELOPMENT_FAIL", null);
    }
    steps.push({ step: "Validation", status: "PASS", detail: "Dhancha, safety aur legacy protection theek" });

    // 6. Registration
    const hash = await sha256(JSON.stringify({ name, instructions: dev.instructions, keywords: dev.keywords }));
    const { data: created, error: insErr } = await sb
      .from("capabilities")
      .insert({
        name,
        description: dev.description,
        domain: dev.domain,
        instructions: dev.instructions,
        keywords: dev.keywords.map((k) => k.toLowerCase()).slice(0, 8),
        status: "ACTIVE",
        validated: true,
        is_core: false,
        sha256: hash,
        evidence: hits.map((h) => ({ title: h.title, url: h.url })),
      })
      .select("*")
      .single();
    if (insErr) {
      steps.push({ step: "Registration", status: "FAIL", detail: insErr.message });
      return finish("AUTONOMOUS_DEVELOPMENT_FAIL", null);
    }
    steps.push({ step: "Registration", status: "PASS", detail: `Registry mein shamil (SHA-256 ${hash.slice(0, 12)}…)` });
    return finish("AUTONOMOUS_DEVELOPMENT_PASS", created as Capability);
  });

export const toggleCapability = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: cap } = await sb.from("capabilities").select("is_core").eq("id", data.id).single();
    if (!cap) throw new Error("Salahiyat nahi mili");
    if (cap.is_core) throw new Error("Core salahiyat mehfooz hai — badli nahi ja sakti");
    const { error } = await sb.from("capabilities").update({ status: data.active ? "ACTIVE" : "DISABLED" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// 2-in-1 router: decides whether a chat command is for Vision Pilot (video) or Dev Master (self-upgrade)
export const classifyCommand = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ command: z.string().min(1).max(4000) }).parse(i))
  .handler(async ({ data }) => {
    return aiJson<{ mode: "video" | "upgrade" | "build" | "chat"; reply: string }>(
      [
        "Route this user command for a multi-purpose system (any language).",
        "mode=video: user wants content/video/script/research for a platform.",
        "mode=build: user wants a game, app, website, tool, calculator, page or AI/chatbot-like app built or changed.",
        "mode=upgrade: user wants the system itself to learn/add a new skill or improve itself (Dev Master).",
        "mode=chat: greeting or general question; then reply briefly in the user's language explaining it can make videos, build games/apps/websites, or upgrade itself. Otherwise reply ''.",
        `Command: ${data.command}`,
      ].join("\n"),
      "route",
      {
        type: "object",
        additionalProperties: false,
        required: ["mode", "reply"],
        properties: { mode: { type: "string", enum: ["video", "upgrade", "build", "chat"] }, reply: { type: "string" } },
      },
    );
  });

export type BuildResult = { title: string; summary: string; html: string };

export const buildProject = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ command: z.string().min(3).max(4000), previousHtml: z.string().max(200000).optional() }).parse(i),
  )
  .handler(async ({ data }) => {
    return aiJson<BuildResult>(
      [
        "You are Dev Master, an expert developer. Build exactly what the user asks as ONE self-contained HTML file.",
        "Rules: inline all CSS and JS, no external scripts/CDNs/network calls, mobile-first touch-friendly, polished dark design, works inside a sandboxed iframe (no localStorage dependency required, wrap it in try/catch).",
        "Games: use canvas or DOM with touch controls plus keyboard. Apps/websites: fully interactive. 'AI' apps: build a working rule-based/offline assistant and explain that in summary.",
        "summary: 2-4 short sentences in the user's language (Roman Urdu if they wrote Roman Urdu) on what was built and how to use it.",
        data.previousHtml ? `Modify this existing project per the command, return the full updated file:\n${data.previousHtml}` : "",
        `Command: ${data.command}`,
      ].join("\n"),
      "build",
      {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "html"],
        properties: { title: { type: "string" }, summary: { type: "string" }, html: { type: "string" } },
      },
    );
  });
