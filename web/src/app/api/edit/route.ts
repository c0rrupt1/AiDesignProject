import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import sharp from "sharp";

import type { GoogleGenerateContentResponse } from "./types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: Request) {
  if (!process.env.GOOGLE_AI_STUDIO_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_AI_STUDIO_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const prompt = formData.get("prompt");
  const image = formData.get("image");
  const mask = formData.get("mask");
  const negativePrompt = formData.get("negativePrompt");
  const guidanceScaleInput = formData.get("guidanceScale");
  const strengthInput = formData.get("strength");
  const seedInput = formData.get("seed");
  const inferenceStepsInput = formData.get("inferenceSteps");

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json(
      { error: "Prompt is required to describe the desired edit." },
      { status: 400 },
    );
  }

  if (!(image instanceof File)) {
    return NextResponse.json(
      { error: "Image file is required under the `image` field." },
      { status: 400 },
    );
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const contentType = image.type || "image/png";

  const apiHost = (
    process.env.GOOGLE_AI_STUDIO_HOST ??
    "https://generativelanguage.googleapis.com"
  ).replace(/\/$/, "");
  const rawModelId =
    process.env.GOOGLE_AI_STUDIO_MODEL_ID ?? "models/gemini-2.5-flash-image";
  const modelId = rawModelId.includes("/")
    ? rawModelId
    : `models/${rawModelId}`;
  const modelEndpoint = `${apiHost}/v1beta/${modelId}:generateContent`;
  const guidanceScale = clampNumber(parseNumber(guidanceScaleInput, 7.5), 1, 20);
  const strength = clampNumber(parseNumber(strengthInput, 0.35), 0.1, 0.9);
  const inferenceSteps = clampInteger(
    parseNumber(inferenceStepsInput, 35),
    10,
    60,
  );
  const parsedSeed = parseNumber(seedInput, Number.NaN);
  const seed = Number.isFinite(parsedSeed) ? Math.floor(parsedSeed) : undefined;

  const imageBase64 = imageBuffer.toString("base64");
  const promptPieces = [prompt.trim()];
  if (typeof negativePrompt === "string" && negativePrompt.trim()) {
    promptPieces.push(`Avoid: ${negativePrompt.trim()}.`);
  }
  promptPieces.push(
    "Use the provided reference photo to preserve layout and perspective.",
  );
  if (inferenceSteps) {
    promptPieces.push(`Target roughly ${inferenceSteps} refinement steps.`);
  }
  promptPieces.push(`Apply changes with an intensity of ${strength}.`);
  const primaryPrompt = promptPieces.join(" ");

  const userParts: Array<Record<string, unknown>> = [
    { text: primaryPrompt },
    {
      inlineData: {
        mimeType: contentType,
        data: imageBase64,
      },
    },
  ];

  let maskBuffer: Buffer | null = null;

  if (mask instanceof File) {
    maskBuffer = Buffer.from(await mask.arrayBuffer());
    userParts.push({
      text: "The following inline data is a PNG mask: white pixels mark regions to edit, black pixels should remain untouched.",
    });
    userParts.push({
      inlineData: {
        mimeType: "image/png",
        data: maskBuffer.toString("base64"),
      },
    });
  }

  if (typeof seed === "number") {
    userParts.push({
      text: `Use a seed of ${seed} if deterministic behavior is supported.`,
    });
  }

  const payload = {
    model: modelId,
    contents: [
      {
        role: "user" as const,
        parts: userParts,
      },
    ],
    generationConfig: {
      candidateCount: 1,
      temperature: clampNumber(guidanceScale / 10, 0, 1),
      responseModalities: ["IMAGE"],
    },
  };

  try {
    const response = await fetch(
      modelEndpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GOOGLE_AI_STUDIO_API_KEY!,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      const rawBody = await response.text();
      return NextResponse.json(
        {
          error:
            formatErrorMessage(errorPayload) ??
            (rawBody ? rawBody.slice(0, 160) : undefined) ??
            `Image edit failed with status ${response.status}`,
        },
        { status: response.status },
      );
    }

    const json: GoogleGenerateContentResponse = await response.json();
    const candidates = Array.isArray(json?.candidates) ? json.candidates : [];
    const inlinePart = candidates
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .find((part) => {
        const inlineData = part?.inlineData;
        return (
          inlineData?.mimeType?.startsWith("image/") &&
          typeof inlineData?.data === "string"
        );
      });

    if (!inlinePart) {
      return NextResponse.json(
        { error: "Google AI Studio did not return an image candidate." },
        { status: 502 },
      );
    }

    const inlineData = inlinePart.inlineData as {
      mimeType?: string;
      data?: string;
    };
    const generatedBuffer = Buffer.from(inlineData.data ?? "", "base64");

    const baseSharp = sharp(imageBuffer);
    const { width: originalWidth, height: originalHeight } =
      await baseSharp.metadata();
    const width = originalWidth ?? originalHeight ?? 1024;
    const height = originalHeight ?? originalWidth ?? 1024;

    const baseImage = await baseSharp
      .resize(width, height, { fit: "cover" })
      .ensureAlpha()
      .png()
      .toBuffer();

    const generatedImage = await sharp(generatedBuffer)
      .resize(width, height, { fit: "cover" })
      .ensureAlpha()
      .toBuffer();

    let finalBuffer: Buffer;

    if (maskBuffer) {
      const alphaChannel = await sharp(maskBuffer)
        .resize(width, height, { fit: "cover" })
        .toColourspace("b-w")
        .linear(strength, 0)
        .toBuffer();

      const overlay = await sharp(generatedImage)
        .removeAlpha()
        .joinChannel(alphaChannel)
        .png()
        .toBuffer();

      finalBuffer = await sharp(baseImage)
        .composite([{ input: overlay, blend: "over" }])
        .png()
        .toBuffer();
    } else {
      finalBuffer = await sharp(generatedImage).png().toBuffer();
    }

    return NextResponse.json({
      image: `data:image/png;base64,${finalBuffer.toString("base64")}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unexpected error while calling the image edit service." },
      { status: 500 },
    );
  }
}

async function safeJson(response: Response) {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

function formatErrorMessage(payload: unknown): string | null {
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

function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampInteger(value: number, min: number, max: number): number {
  const rounded = Math.round(value);
  return Math.min(Math.max(rounded, min), max);
}
