import { NextResponse } from "next/server";

import type { OpenRouterChatCompletionsResponse } from "../edit/types";

const DEFAULT_MODEL = "google/gemma-3-4b-it";

type RequestBody = {
  imageDataUrl?: string;
  sourceLabel?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body provided." },
      { status: 400 },
    );
  }

  const imageDataUrl = typeof body.imageDataUrl === "string"
    ? body.imageDataUrl.trim()
    : "";

  if (!imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "A base64-encoded image data URL is required." },
      { status: 400 },
    );
  }

  const modelId =
    process.env.OPENROUTER_KEYWORDS_MODEL?.trim() || DEFAULT_MODEL;
  const apiBaseUrl = (
    process.env.OPENROUTER_API_BASE_URL ?? "https://openrouter.ai/api/v1"
  ).replace(/\/$/, "");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (process.env.OPENROUTER_HTTP_REFERER) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
  }

  if (process.env.OPENROUTER_APP_TITLE) {
    headers["X-Title"] = process.env.OPENROUTER_APP_TITLE;
  }

  const promptInstructions =
    "Return a concise, comma-separated list of 8 to 12 shopping keywords that a person could paste into Google Shopping to find the main item shown. " +
    "Emphasize product category, materials, finishes, dominant colors, design style, and room placement. Avoid full sentences, avoid numbering. " +
    "Do not mention photography, branding, or any meta commentary.";

  const payload = {
    model: modelId,
    temperature: 0.2,
    max_tokens: 200,
    messages: [
      {
        role: "system" as const,
        content:
          "You are a merchandising assistant that extracts shopping keywords from interior design photos. Always respond with only a comma-separated list.",
      },
      {
        role: "user" as const,
        content: [
          {
            type: "text",
            text: body.sourceLabel
              ? `${promptInstructions}\nUse this context: ${body.sourceLabel}.`
              : promptInstructions,
          },
          {
            type: "image_url",
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      const rawBody = await response.text();
      return NextResponse.json(
        {
          error:
            extractErrorMessage(errorPayload) ??
            (rawBody ? rawBody.slice(0, 160) : undefined) ??
            `Keyword extraction failed with status ${response.status}`,
        },
        { status: response.status },
      );
    }

    const json: OpenRouterChatCompletionsResponse = await response.json();
    const text = extractFirstText(json);

    if (!text) {
      return NextResponse.json(
        {
          error:
            "OpenRouter did not return any shopping keywords for this image.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ keywords: text.trim() });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unexpected error while requesting shopping keywords." },
      { status: 500 },
    );
  }
}

function extractFirstText(
  payload: OpenRouterChatCompletionsResponse,
): string | null {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  for (const choice of choices) {
    const message = choice?.message;
    if (!message) continue;
    if (typeof message.content === "string" && message.content.trim()) {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part && typeof part === "object" && part.type === "text") {
          const text = (part as { text?: string }).text;
          if (typeof text === "string" && text.trim()) {
            return text;
          }
        }
      }
    }
  }
  return null;
}

async function safeJson(response: Response) {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as Record<string, unknown>).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message;
    return JSON.stringify(error);
  }
  const message = (payload as Record<string, unknown>).message;
  if (typeof message === "string" && message.trim()) return message;
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}
