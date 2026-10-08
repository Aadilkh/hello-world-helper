import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  sceneAt: z.number().min(0).max(36000),
  command: z.string().min(3).max(4000),
  frames: z.array(z.object({ at: z.number().min(0).max(36000), dataUrl: z.string().max(1_000_000).regex(/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/) })).min(2).max(5),
  audioDataUrl: z.string().max(700_000).optional().nullable(),
});

export type SceneAnalysis = { summary: string; movement: string; expression: string; speech: string; adaptation: string; limitations: string };

export const analyzeVideoScene = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<SceneAnalysis> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI service dastiyab nahi hai.");

    const hasAudio = data.audioDataUrl && data.audioDataUrl.length > 0;

    const content: Array<Record<string, unknown>> = [
      { type: "input_text", text: `Analyze ONLY these sampled frames near ${data.sceneAt}s in order, for a new original video. User request: ${data.command}. Describe visible body/camera movement changes and observable facial expression cues.${hasAudio ? " Also analyze the provided audio clip near the same timestamp: transcribe any speech (in whatever language it is), and describe the spoken content and tone." : ""} Do not infer unseen footage, emotions as facts, identities, or sound. Never copy an existing person's identity or exact protected scene. State the frames-only limitation if audio is absent. Return JSON in the user's language (except adaptation may be English for video prompt).` },
    ];
    for (const frame of data.frames) {
      content.push({ type: "input_text", text: `Frame at ${frame.at.toFixed(1)} seconds:` });
      content.push({ type: "input_image", image_url: frame.dataUrl });
    }
    if (hasAudio) {
      content.push({ type: "input_text", text: `Audio clip near ${data.sceneAt}s (transcribe and analyze speech):` });
      content.push({ type: "input_audio", input_audio: { data: data.audioDataUrl!, format: "webm" } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra", stream: true, store: false,
        reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "scene_analysis", strict: true, schema: {
          type: "object", additionalProperties: false,
          required: ["summary", "movement", "expression", "speech", "adaptation", "limitations"],
          properties: Object.fromEntries(["summary", "movement", "expression", "speech", "adaptation", "limitations"].map((name) => [name, { type: "string" }])),
        } } },
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
      throw new Error(error?.message ?? error?.error?.message ?? `Scene analysis fail hui (${response.status})`);
    }
    if (!response.body) throw new Error("AI ka jawab nahi mila.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", result = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        let event: { type?: string; delta?: string; message?: string; response?: { error?: { message?: string } } };
        try { event = JSON.parse(payload); } catch { continue; }
        if (event.type === "response.output_text.delta") result += event.delta ?? "";
        if (event.type === "error" || event.type === "response.failed") throw new Error(event.message ?? event.response?.error?.message ?? "Scene analysis fail hui.");
      }
    }
    if (!result) throw new Error("AI ne scene ka jawab nahi diya.");
    return JSON.parse(result) as SceneAnalysis;
  });
