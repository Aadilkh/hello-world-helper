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

// ---------- Full Vision Pilot PWA Bundle ----------

export type BundleResult = { html: string; fileName: string; sizeKb: number };

export const bundleVisionPilot = createServerFn({ method: "POST" }).handler(async (): Promise<BundleResult> => {
  const appName = "Vision Pilot";
  const fileName = "vision-pilot";

  // SVG icon encoded as data URI (192x192 and 512x512 from same SVG)
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0d5c4b"/><rect x="96" y="128" width="320" height="256" rx="24" fill="none" stroke="#f4bd32" stroke-width="16"/><circle cx="160" cy="192" r="14" fill="#f4bd32"/><circle cx="352" cy="192" r="14" fill="#f4bd32"/><path d="M176 320 L256 224 L336 320 Z" fill="#f4bd32"/><text x="256" y="420" font-family="sans-serif" font-size="48" font-weight="bold" fill="#f4bd32" text-anchor="middle">VP</text></svg>`;
  const iconDataUri = `data:image/svg+xml;base64,${btoa(iconSvg)}`;

  const manifest = JSON.stringify({
    name: appName,
    short_name: "VisionPilot",
    description: "AI creative workspace — video, app aur content banayein",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f8f5",
    theme_color: "#0d5c4b",
    categories: ["productivity", "entertainment", "business"],
    lang: "ur",
    dir: "auto",
    icons: [
      { src: iconDataUri, sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
      { src: iconDataUri, sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
    ],
  }, null, 2);

  const manifestB64 = btoa(manifest);

  // Inline service worker as blob URL (works for standalone HTML file)
  const swCode = `const CACHE='vision-pilot-v1';self.addEventListener('install',e=>{self.skipWaiting()});self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});`;

  const pwaHtml = `<!DOCTYPE html>
<html lang="ur" dir="auto">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=5.0">
<meta name="theme-color" content="#0d5c4b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Vision Pilot">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="data:application/manifest+json;base64,${manifestB64}">
<link rel="apple-touch-icon" href="${iconDataUri}">
<link rel="icon" href="${iconDataUri}">
<title>Vision Pilot — Installable App</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#0d5c4b;--accent:#f4bd32;--bg:#f5f8f5;--card:#fff;--border:#dce8de;--text:#183b32;--muted:#688078}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
.install-card{width:min(440px,100%);background:var(--card);border:1px solid var(--border);border-radius:24px;padding:36px 28px;text-align:center;box-shadow:0 20px 60px #0d5c4b15}
.app-icon{width:88px;height:88px;border-radius:22px;background:var(--primary);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 10px 30px #0d5c4b30}
.app-icon svg{width:48px;height:48px}
.app-name{font-size:24px;font-weight:800;letter-spacing:-.03em;margin-bottom:4px}
.app-tagline{color:var(--muted);font-size:13px;line-height:1.6;margin-bottom:24px}
.install-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border:0;border-radius:14px;background:var(--primary);color:#fff;font-size:15px;font-weight:700;cursor:pointer;transition:.2s}
.install-btn:hover{background:#0a4a3c;transform:translateY(-1px)}
.install-btn:disabled{opacity:.5;cursor:default;transform:none}
.install-btn.installed{background:#22c55e}
.steps{text-align:left;margin:24px 0;padding:20px;border-radius:14px;background:#f1f8f0}
.steps h3{font-size:13px;font-weight:700;margin-bottom:12px;color:var(--primary)}
.steps ol{padding-left:20px}
.steps li{font-size:12px;line-height:1.7;color:var(--muted);margin-bottom:6px}
.steps li b{color:var(--text)}
.feature-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:20px}
.feature-chip{padding:6px 12px;border-radius:20px;background:#e8f1ea;color:var(--primary);font-size:11px;font-weight:600}
.foot{margin-top:16px;font-size:11px;color:var(--muted)}
.spinner{width:20px;height:20px;border:2.5px solid #ffffff40;border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.hidden{display:none}
</style>
</head>
<body>
<div class="install-card">
<div class="app-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none"><rect x="96" y="128" width="320" height="256" rx="24" stroke="#f4bd32" stroke-width="24"/><circle cx="160" cy="192" r="18" fill="#f4bd32"/><circle cx="352" cy="192" r="18" fill="#f4bd32"/><path d="M176 320 L256 224 L336 320 Z" fill="#f4bd32"/></svg></div>
<div class="app-name">Vision Pilot</div>
<div class="app-tagline">AI creative workspace — video, app aur content banayein</div>
<div class="feature-row"><span class="feature-chip">AI Research Brain</span><span class="feature-chip">Video Studio</span><span class="feature-chip">App Builder</span><span class="feature-chip">Code Analysis</span><span class="feature-chip">PWA Packaging</span></div>
<button class="install-btn" id="installBtn" onclick="handleInstall()">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>
<span id="btnText">Install Vision Pilot</span>
</button>
<div class="steps" id="manualSteps">
<h3>Manual install steps:</h3>
<ol>
<li><b>Chrome (Android):</b> Browser menu (⋮) → "Install app" ya "Add to Home screen"</li>
<li><b>Safari (iPhone):</b> Share button (􏱴) → "Add to Home Screen"</li>
<li><b>Desktop:</b> Address bar mein install icon 􏰖 click karein</li>
</ol>
</div>
<div class="foot">Vision Pilot PWA v1.0 · Offline-ready · Mobile-first</div>
</div>
<script>
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').classList.remove('hidden')});
window.addEventListener('appinstalled',function(){var b=document.getElementById('installBtn');b.classList.add('installed');document.getElementById('btnText').textContent='Installed! 􏰗';deferredPrompt=null});
function handleInstall(){
if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.then(function(r){if(r.outcome==='accepted'){var b=document.getElementById('installBtn');b.classList.add('installed');document.getElementById('btnText').textContent='Installed! 􏰗'}deferredPrompt=null})}
else{alert('Browser menu se "Install app" ya "Add to Home Screen" select karein')}}
// Register inline service worker via Blob
try{
var swBlob=new Blob([\`${swCode}\`],{type:'text/javascript'});
var swUrl=URL.createObjectURL(swBlob);
if('serviceWorker' in navigator){navigator.serviceWorker.register(swUrl).catch(function(){})}
}catch(e){}
</script>
</body>
</html>`;

  const sizeKb = Math.round(pwaHtml.length / 1024);
  return { html: pwaHtml, fileName, sizeKb };
});
