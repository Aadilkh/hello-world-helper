// Shared Google Gemini API helper — replaces Lovable AI gateway.
// Uses GEMINI_API_KEY env var. Model: gemini-2.0-flash.

const MODEL = "gemini-2.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type JsonSchema = Record<string, unknown>;

function apiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("Gemini API key missing. GEMINI_API_KEY env var set karein.");
  return key;
}

function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const convert = (s: JsonSchema): JsonSchema => {
    const out: JsonSchema = {};
    if (s["type"]) out["type"] = (s["type"] as string).toUpperCase();
    if (s["description"]) out["description"] = s["description"];
    if (s["enum"]) out["enum"] = s["enum"];
    if (s["required"]) out["required"] = s["required"];
    if (s["properties"]) {
      out["properties"] = {};
      for (const [k, v] of Object.entries(s["properties"] as Record<string, JsonSchema>)) {
        out["properties"][k] = convert(v);
      }
    }
    if (s["items"]) out["items"] = convert(s["items"] as JsonSchema);
    return out;
  };
  return convert(schema);
}

async function generateContent(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(err?.error?.message ?? `Gemini request failed (${res.status})`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    promptFeedback?: { blockReason?: string };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(data.promptFeedback?.blockReason ?? "Gemini ne khali jawab diya");
  return text;
}

export async function geminiJson<T>(prompt: string, schema: JsonSchema): Promise<T> {
  const text = await generateContent({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) },
  });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini ka JSON parse nahi hua — dobara koshish karein");
  }
}

export async function geminiText(prompt: string): Promise<string> {
  return generateContent({ contents: [{ parts: [{ text: prompt }] }] });
}

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export async function geminiMultimodalJson<T>(parts: GeminiPart[], schema: JsonSchema): Promise<T> {
  const text = await generateContent({
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) },
  });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini ka JSON parse nahi hua — dobara koshish karein");
  }
}

export async function geminiMultimodalText(parts: GeminiPart[]): Promise<string> {
  return generateContent({ contents: [{ parts }] });
}
