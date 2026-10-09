import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

type Db = Awaited<ReturnType<typeof import("@/integrations/supabase/client.server")>>["supabaseAdmin"];

async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Db;
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
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
      } catch (e) {
        if (e instanceof Error && e.message === "AI request failed") throw e;
      }
    }
  }
  return text;
}

async function aiJson<T>(prompt: string, name: string, schema: Record<string, unknown>): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI service dastiyab nahi hai.");
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra", stream: true, store: false,
      input: prompt,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const e = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
    throw new Error(e?.message ?? e?.error?.message ?? `AI request failed (${res.status})`);
  }
  const text = await readStream(res);
  return JSON.parse(text) as T;
}

// ---------- App Connections ----------

export type AppConnection = { id: string; app_name: string; category: string; connected: boolean; notes: string; created_at: string };

export const listAppConnections = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  const { data, error } = await sb.from("app_connections").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { connections: (data ?? []) as AppConnection[] };
});

const ToggleInput = z.object({ appName: z.string().min(1).max(100), category: z.string().min(1).max(50) });

export const toggleAppConnection = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ToggleInput.parse(i))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: existing } = await sb.from("app_connections").select("*").eq("app_name", data.appName).maybeSingle();
    if (existing) {
      const { data: updated, error } = await sb.from("app_connections")
        .update({ connected: !existing.connected }).eq("id", existing.id).select("*").single();
      if (error) throw new Error(error.message);
      return { connection: updated as AppConnection };
    }
    const { data: created, error } = await sb.from("app_connections")
      .insert({ app_name: data.appName, category: data.category, connected: true }).select("*").single();
    if (error) throw new Error(error.message);
    return { connection: created as AppConnection };
  });

const UpdateNotesInput = z.object({ appName: z.string().min(1).max(100), notes: z.string().max(500) });

export const updateAppNotes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => UpdateNotesInput.parse(i))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: existing } = await sb.from("app_connections").select("id").eq("app_name", data.appName).maybeSingle();
    if (!existing) {
      const { data: created, error } = await sb.from("app_connections")
        .insert({ app_name: data.appName, category: "General", connected: false, notes: data.notes }).select("*").single();
      if (error) throw new Error(error.message);
      return { connection: created as AppConnection };
    }
    const { data: updated, error } = await sb.from("app_connections")
      .update({ notes: data.notes }).eq("id", existing.id).select("*").single();
    if (error) throw new Error(error.message);
    return { connection: updated as AppConnection };
  });

// ---------- Code Structure Analysis ----------

export type CodeAnalysis = {
  overview: string;
  architecture: string;
  components: Array<{ name: string; purpose: string }>;
  dataFlow: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: Array<{ title: string; detail: string }>;
  techStack: string[];
};

const AnalyzeCodeInput = z.object({
  html: z.string().min(10).max(200000),
  projectName: z.string().max(200).optional(),
});

export const analyzeCodeStructure = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AnalyzeCodeInput.parse(i))
  .handler(async ({ data }): Promise<CodeAnalysis> => {
    const truncated = data.html.length > 30000 ? data.html.slice(0, 15000) + "\n...\n" + data.html.slice(-15000) : data.html;
    return aiJson<CodeAnalysis>(
      [
        "You are a senior software architect analyzing the coding structure of a built project.",
        data.projectName ? `Project name: ${data.projectName}` : "",
        "Analyze the HTML/CSS/JS code structure below. Identify architecture, components, data flow, strengths, weaknesses, and improvement suggestions.",
        "Return JSON in the user's language (Roman Urdu if the code comments are in Roman Urdu, otherwise English).",
        `Code:\n${truncated}`,
      ].filter(Boolean).join("\n"),
      "code_analysis",
      {
        type: "object", additionalProperties: false,
        required: ["overview", "architecture", "components", "dataFlow", "strengths", "weaknesses", "suggestions", "techStack"],
        properties: {
          overview: { type: "string" },
          architecture: { type: "string" },
          components: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "purpose"], properties: { name: { type: "string" }, purpose: { type: "string" } } } },
          dataFlow: { type: "string" },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "detail"], properties: { title: { type: "string" }, detail: { type: "string" } } } },
          techStack: { type: "array", items: { type: "string" } },
        },
      },
    );
  });

// ---------- Virtual Servers ----------

export type VirtualServer = { id: string; name: string; host: string; status: string; last_connected_at: string | null; created_at: string };

export const listVirtualServers = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  const { data, error } = await sb.from("virtual_servers").select("*").order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { servers: (data ?? []) as VirtualServer[] };
});

const ServerInput = z.object({ name: z.string().min(1).max(100), host: z.string().max(200).optional() });

export const addVirtualServer = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ServerInput.parse(i))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: created, error } = await sb.from("virtual_servers")
      .insert({ name: data.name, host: data.host ?? "", status: "offline" }).select("*").single();
    if (error) throw new Error(error.message);
    return { server: created as VirtualServer };
  });

const ConnectServerInput = z.object({ id: z.string().uuid() });

export const connectVirtualServer = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ConnectServerInput.parse(i))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: server } = await sb.from("virtual_servers").select("*").eq("id", data.id).maybeSingle();
    if (!server) throw new Error("Server nahi mila");
    const newStatus = server.status === "online" ? "offline" : "online";
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "online") updates.last_connected_at = new Date().toISOString();
    const { data: updated, error } = await sb.from("virtual_servers").update(updates).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return { server: updated as VirtualServer };
  });

export const deleteVirtualServer = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ConnectServerInput.parse(i))
  .handler(async ({ data }) => {
    const sb = await db();
    const { error } = await sb.from("virtual_servers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- APK/PWA Packaging ----------

export type ApkResult = { manifest: string; html: string; fileName: string };

const ApkInput = z.object({ html: z.string().min(10).max(200000), title: z.string().max(200) });

export const packageApk = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ApkInput.parse(i))
  .handler(async ({ data }): Promise<ApkResult> => {
    const appName = data.title.replace(/[^a-zA-Z0-9]+/g, " ").trim() || "Vision Pilot App";
    const fileName = data.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "app";

    const manifest = JSON.stringify({
      name: appName,
      short_name: appName.slice(0, 30),
      description: `Built with Vision Pilot: ${appName}`,
      start_url: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
      icons: [],
    }, null, 2);

    const pwaHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
<meta name="theme-color" content="#0a0a0a">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="data:application/manifest+json;base64,${btoa(manifest)}">
<title>${appName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#fff;overflow-x:hidden}
.vp-pwa-frame{width:100%;min-height:100vh;display:flex;flex-direction:column}
.vp-pwa-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#111;border-bottom:1px solid #222;font-size:12px;color:#888;flex-shrink:0}
.vp-pwa-bar b{color:#fff;font-size:13px}
.vp-pwa-bar .vp-dot{width:8px;height:8px;border-radius:50%;background:#22c55e}
.vp-pwa-content{flex:1;overflow:auto}
.vp-pwa-content iframe{width:100%;height:100%;border:none}
</style>
</head>
<body>
<div class="vp-pwa-frame">
<div class="vp-pwa-bar"><span class="vp-dot"></span><b>${appName}</b><span>Vision Pilot PWA</span></div>
<div class="vp-pwa-content">
<iframe srcDoc="${data.html.replace(/"/g, "&quot;").replace(/&/g, "&amp;")}" sandbox="allow-scripts allow-forms allow-modals"></iframe>
</div>
</div>
<script>
// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferredPrompt=e});
window.addEventListener('click',()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null}});
</script>
</body>
</html>`;

    return { manifest, html: pwaHtml, fileName };
  });
