import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { geminiMultimodalJson } from "@/lib/gemini";
import type { GeminiPart } from "@/lib/gemini";

const Input = z.object({
  sceneAt: z.number().min(0).max(36000),
  command: z.string().min(3).max(4000),
  frames: z.array(z.object({ at: z.number().min(0).max(36000), dataUrl: z.string().max(1_000_000).regex(/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/) })).min(2).max(5),
  audioDataUrl: z.string().max(700_000).optional().nullable(),
});

export type SceneAnalysis = { summary: string; movement: string; expression: string; speech: string; adaptation: string; limitations: string };

export type TutorialAnalysis = { title: string; topic: string; summary: string; keyPoints: string[]; chapters: { time: string; title: string }[]; language: string; difficulty: string; adaptation: string };

const TutorialInput = z.object({
  command: z.string().min(3).max(4000),
  frames: z.array(z.object({ at: z.number().min(0).max(36000), dataUrl: z.string().max(1_000_000).regex(/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/) })).min(3).max(8),
  duration: z.number().min(1).max(36000),
});

function dataUrlToInlinePart(dataUrl: string): GeminiPart {
  const match = /^data:(image\/jpeg);base64,(.+)$/i.exec(dataUrl);
  if (match) {
    return { inline_data: { mime_type: "image/jpeg", data: match[2]! } };
  }
  return { text: "(invalid frame)" };
}

export const analyzeTutorialVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TutorialInput.parse(input))
  .handler(async ({ data }): Promise<TutorialAnalysis> => {
    const parts: GeminiPart[] = [
      { text: `You are analyzing a tutorial or course video (${data.duration.toFixed(0)}s long). User request: ${data.command}. These ${data.frames.length} frames are sampled across the entire video in order. Identify the tutorial topic, key teaching points, chapter/section breakdowns with timestamps, spoken language (if visible from slides/text), difficulty level, and how this knowledge could be adapted into new original content. Return JSON in the user's language (except adaptation may be English).` },
    ];
    for (const frame of data.frames) {
      parts.push({ text: `Frame at ${frame.at.toFixed(1)}s:` });
      parts.push(dataUrlToInlinePart(frame.dataUrl));
    }

    return geminiMultimodalJson<TutorialAnalysis>(parts, {
      type: "object",
      additionalProperties: false,
      required: ["title", "topic", "summary", "keyPoints", "chapters", "language", "difficulty", "adaptation"],
      properties: {
        title: { type: "string" },
        topic: { type: "string" },
        summary: { type: "string" },
        keyPoints: { type: "array", items: { type: "string" } },
        chapters: { type: "array", items: { type: "object", additionalProperties: false, required: ["time", "title"], properties: { time: { type: "string" }, title: { type: "string" } } } },
        language: { type: "string" },
        difficulty: { type: "string" },
        adaptation: { type: "string" },
      },
    });
  });

export const analyzeVideoScene = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<SceneAnalysis> => {
    const hasAudio = data.audioDataUrl && data.audioDataUrl.length > 0;

    const parts: GeminiPart[] = [
      { text: `Analyze ONLY these sampled frames near ${data.sceneAt}s in order, for a new original video. User request: ${data.command}. Describe visible body/camera movement changes and observable facial expression cues.${hasAudio ? " Also analyze the provided audio clip near the same timestamp: transcribe any speech (in whatever language it is), and describe the spoken content and tone." : ""} Do not infer unseen footage, emotions as facts, identities, or sound. Never copy an existing person's identity or exact protected scene. State the frames-only limitation if audio is absent. Return JSON in the user's language (except adaptation may be English for video prompt).` },
    ];
    for (const frame of data.frames) {
      parts.push({ text: `Frame at ${frame.at.toFixed(1)} seconds:` });
      parts.push(dataUrlToInlinePart(frame.dataUrl));
    }
    if (hasAudio) {
      const audioMatch = /^data:audio\/webm;base64,(.+)$/i.exec(data.audioDataUrl!);
      if (audioMatch) {
        parts.push({ text: `Audio clip near ${data.sceneAt}s (transcribe and analyze speech):` });
        parts.push({ inline_data: { mime_type: "audio/webm", data: audioMatch[1]! } });
      }
    }

    return geminiMultimodalJson<SceneAnalysis>(parts, {
      type: "object",
      additionalProperties: false,
      required: ["summary", "movement", "expression", "speech", "adaptation", "limitations"],
      properties: Object.fromEntries(["summary", "movement", "expression", "speech", "adaptation", "limitations"].map((name) => [name, { type: "string" }])),
    });
  });
