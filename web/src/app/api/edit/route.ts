import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { put } from "@vercel/blob";

import type { OpenRouterChatCompletionsResponse } from "./types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BASE_IMAGE_BYTES = 12 * 1024 * 1024; // 12MB
const MAX_MASK_BYTES = 6 * 1024 * 1024; // 6MB
const MAX_INSERT_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_IMAGE_DIMENSION = 4096;
const MAX_TOTAL_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION;
const ALLOWED_BASE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]);
const ALLOWED_INSERT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]);
const MASK_TYPE = "image/png";

const blobToken =
  process.env.BLOB_READ_WRITE_TOKEN?.trim() ??
  process.env.VERCEL_BLOB_WRITE_TOKEN?.trim() ??
  process.env.VERCEL_BLOB_READ_WRITE_TOKEN?.trim() ??
  process.env.BLOB_WRITE_TOKEN?.trim() ??
  null;

const blobBaseUrl = process.env.BLOB_BASE_URL?.replace(/\/+$/, "") ?? null;
const blobStoreId = process.env.BLOB_STORE_ID?.trim() ?? null;
const blobFolderPrefix =
  process.env.BLOB_FOLDER_PREFIX?.replace(/^\/+|\/+$/g, "") ??
  "gemini-makeovers";

const blobUploadsEnabled = Boolean(blobToken);

type BlobSummary = {
  pathname: string;
  url: string;
  downloadUrl: string | null;
  contentType: string | null;
};

type BlobDocumentation = {
  sessionPath: string;
  input?: BlobSummary | null;
  mask?: BlobSummary | null;
  output?: BlobSummary | null;
  metadata?: BlobSummary | null;
  details?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!openRouterApiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not set on the server." },
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
  const insertImage = formData.get("insertImage");
  const insertXInput = formData.get("insertX");
  const insertYInput = formData.get("insertY");
  const insertWidthInput = formData.get("insertWidth");
  const insertHeightInput = formData.get("insertHeight");

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

  if (image.size > MAX_BASE_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error: `Base image exceeds the ${Math.floor(MAX_BASE_IMAGE_BYTES / (1024 * 1024))}MB upload limit.`,
      },
      { status: 413 },
    );
  }

  const normalizedContentType =
    typeof image.type === "string" ? image.type.toLowerCase() : "";
  if (
    normalizedContentType &&
    !ALLOWED_BASE_TYPES.has(normalizedContentType)
  ) {
    return NextResponse.json(
      {
        error: "Base image must be PNG, JPEG, WebP, or AVIF.",
      },
      { status: 415 },
    );
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const baseSharpForValidation = sharp(imageBuffer, {
    limitInputPixels: MAX_TOTAL_PIXELS,
  });

  let baseWidth = 0;
  let baseHeight = 0;
  try {
    const metadata = await baseSharpForValidation.metadata();
    baseWidth = metadata.width ?? 0;
    baseHeight = metadata.height ?? 0;
    if (
      baseWidth > MAX_IMAGE_DIMENSION ||
      baseHeight > MAX_IMAGE_DIMENSION ||
      baseWidth * baseHeight > MAX_TOTAL_PIXELS
    ) {
      return NextResponse.json(
        {
          error: `Base image dimensions exceed ${MAX_IMAGE_DIMENSION}px on a side.`,
        },
        { status: 413 },
      );
    }
  } catch (error) {
    console.error("Failed to read base image metadata.", error);
    return NextResponse.json(
      { error: "Unable to process the base image. Upload a valid photo file." },
      { status: 415 },
    );
  }

  const contentType =
    normalizedContentType && ALLOWED_BASE_TYPES.has(normalizedContentType)
      ? normalizedContentType
      : "image/png";

  const apiBaseUrl = (
    process.env.OPENROUTER_API_BASE_URL ?? "https://openrouter.ai/api/v1"
  ).replace(/\/$/, "");
  const modelId =
    process.env.OPENROUTER_IMAGE_MODEL ??
    "google/gemini-2.5-flash-image-preview";
  const guidanceScale = clampNumber(parseNumber(guidanceScaleInput, 7.5), 1, 20);
  const strength = clampNumber(parseNumber(strengthInput, 0.35), 0.1, 0.9);
  const inferenceSteps = clampInteger(
    parseNumber(inferenceStepsInput, 35),
    10,
    60,
  );
  const parsedSeed = parseNumber(seedInput, Number.NaN);
  const seed = Number.isFinite(parsedSeed) ? Math.floor(parsedSeed) : undefined;
  const insertCoordinates = {
    x: parseNumber(insertXInput, Number.NaN),
    y: parseNumber(insertYInput, Number.NaN),
    width: parseNumber(insertWidthInput, Number.NaN),
    height: parseNumber(insertHeightInput, Number.NaN),
  };
  const insertImageFile = insertImage instanceof File ? insertImage : null;
  const insertRegionValid =
    insertImageFile !== null &&
    Number.isFinite(insertCoordinates.x) &&
    Number.isFinite(insertCoordinates.y) &&
    Number.isFinite(insertCoordinates.width) &&
    Number.isFinite(insertCoordinates.height) &&
    insertCoordinates.width > 0 &&
    insertCoordinates.height > 0;
  const normalizedInsertRegion = insertRegionValid
    ? (() => {
        const x = clampNumber(insertCoordinates.x, 0, 1);
        const y = clampNumber(insertCoordinates.y, 0, 1);
        let width = clampNumber(insertCoordinates.width, 0.01, 1);
        let height = clampNumber(insertCoordinates.height, 0.01, 1);
        if (x + width > 1) {
          width = clampNumber(1 - x, 0.01, 1);
        }
        if (y + height > 1) {
          height = clampNumber(1 - y, 0.01, 1);
        }
        return { x, y, width, height };
      })()
    : null;

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

  const temperature = clampNumber(guidanceScale / 10, 0, 2);
  const messageContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: primaryPrompt,
    },
    {
      type: "image_url",
      image_url: {
        url: `data:${contentType};base64,${imageBase64}`,
      },
    },
  ];

  let insertBuffer: Buffer | null = null;
  let insertContentType: string | null = null;
  let maskBuffer: Buffer | null = null;

  if (mask instanceof File) {
    if (mask.size > MAX_MASK_BYTES) {
      return NextResponse.json(
        {
          error: `Mask image exceeds the ${Math.floor(MAX_MASK_BYTES / (1024 * 1024))}MB upload limit.`,
        },
        { status: 413 },
      );
    }

    const maskType =
      typeof mask.type === "string" ? mask.type.toLowerCase() : MASK_TYPE;
    if (maskType && maskType !== MASK_TYPE) {
      return NextResponse.json(
        {
          error: "Mask image must be a PNG file.",
        },
        { status: 415 },
      );
    }

    maskBuffer = Buffer.from(await mask.arrayBuffer());
    try {
      const maskMetadata = await sharp(maskBuffer, {
        limitInputPixels: MAX_TOTAL_PIXELS,
      }).metadata();
      const width = maskMetadata.width ?? 0;
      const height = maskMetadata.height ?? 0;
      if (
        width > MAX_IMAGE_DIMENSION ||
        height > MAX_IMAGE_DIMENSION ||
        width * height > MAX_TOTAL_PIXELS
      ) {
        return NextResponse.json(
          {
            error: `Mask dimensions exceed ${MAX_IMAGE_DIMENSION}px on a side.`,
          },
          { status: 413 },
        );
      }
    } catch (error) {
      console.error("Failed to read mask metadata.", error);
      return NextResponse.json(
        { error: "Unable to process the mask image. Upload a valid PNG mask." },
        { status: 415 },
      );
    }
    messageContent.push({
      type: "text",
      text: "The following image is a PNG mask: white pixels mark regions to edit, black pixels should remain untouched.",
    });
    messageContent.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${maskBuffer.toString("base64")}`,
      },
    });
  }

  if (insertImageFile && normalizedInsertRegion) {
    try {
      if (insertImageFile.size > MAX_INSERT_BYTES) {
        return NextResponse.json(
          {
            error: `Reference object exceeds the ${Math.floor(MAX_INSERT_BYTES / (1024 * 1024))}MB upload limit.`,
          },
          { status: 413 },
        );
      }

      insertBuffer = Buffer.from(await insertImageFile.arrayBuffer());
      insertContentType =
        insertImageFile.type && insertImageFile.type !== "application/octet-stream"
          ? insertImageFile.type
          : "image/png";
      const normalizedInsertType =
        typeof insertContentType === "string"
          ? insertContentType.toLowerCase()
          : "";
      if (
        normalizedInsertType &&
        !ALLOWED_INSERT_TYPES.has(normalizedInsertType)
      ) {
        return NextResponse.json(
          {
            error: "Reference object must be PNG, JPEG, WebP, or AVIF.",
          },
          { status: 415 },
        );
      }
      try {
        const insertMetadata = await sharp(insertBuffer, {
          limitInputPixels: MAX_TOTAL_PIXELS,
        }).metadata();
        const width = insertMetadata.width ?? 0;
        const height = insertMetadata.height ?? 0;
        if (
          width > MAX_IMAGE_DIMENSION ||
          height > MAX_IMAGE_DIMENSION ||
          width * height > MAX_TOTAL_PIXELS
        ) {
          return NextResponse.json(
            {
              error: `Reference object dimensions exceed ${MAX_IMAGE_DIMENSION}px on a side.`,
            },
            { status: 413 },
          );
        }
      } catch (error) {
        console.error("Failed to read reference object metadata.", error);
        return NextResponse.json(
          {
            error:
              "Unable to process the reference object. Upload a valid image file.",
          },
          { status: 415 },
        );
      }
      const describePercent = (value: number) => {
        const rounded = Math.round(value * 1000) / 10;
        return `${rounded % 1 === 0 ? Math.trunc(rounded) : rounded}%`;
      };
      messageContent.push({
        type: "text",
        text: `Blend the provided object into the room inside the highlighted region: top-left ${describePercent(
          normalizedInsertRegion.x,
        )} from the left and ${describePercent(
          normalizedInsertRegion.y,
        )} from the top. The box spans ${describePercent(
          normalizedInsertRegion.width,
        )} of the width and ${describePercent(
          normalizedInsertRegion.height,
        )} of the height. Preserve lighting, scale, and shadows so it feels grounded.`,
      });
      messageContent.push({
        type: "text",
        text: "Reference object image:",
      });
      messageContent.push({
        type: "image_url",
        image_url: {
          url: `data:${insertContentType};base64,${insertBuffer.toString("base64")}`,
        },
      });
    } catch (error) {
      console.error("Failed to serialise the insert reference image.", error);
      insertBuffer = null;
      insertContentType = null;
    }
  }

  if (typeof seed === "number") {
    messageContent.push({
      type: "text",
      text: `Use a seed of ${seed} if deterministic behavior is supported.`,
    });
  }

  const payload = {
    model: modelId,
    messages: [
      {
        role: "user" as const,
        content: messageContent,
      },
    ],
    modalities: ["image", "text"],
    temperature,
  };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openRouterApiKey}`,
    };

    if (process.env.OPENROUTER_HTTP_REFERER) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
    }

    if (process.env.OPENROUTER_APP_TITLE) {
      headers["X-Title"] = process.env.OPENROUTER_APP_TITLE;
    }

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
            formatErrorMessage(errorPayload) ??
            (rawBody ? rawBody.slice(0, 160) : undefined) ??
            `Image edit failed with status ${response.status}`,
        },
        { status: response.status },
      );
    }

    const json: OpenRouterChatCompletionsResponse = await response.json();
    const imageDataUrl = extractFirstImageUrl(json);

    if (!imageDataUrl) {
      return NextResponse.json(
        { error: "OpenRouter did not return an image candidate." },
        { status: 502 },
      );
    }

    const parsedImage = parseDataUrl(imageDataUrl);
    if (!parsedImage) {
      return NextResponse.json(
        { error: "Received an unrecognised image payload from OpenRouter." },
        { status: 502 },
      );
    }

    const generatedBuffer = Buffer.from(parsedImage.base64Data, "base64");

    const width =
      baseWidth > 0 ? baseWidth : baseHeight > 0 ? baseHeight : 1024;
    const height =
      baseHeight > 0 ? baseHeight : baseWidth > 0 ? baseWidth : 1024;
    const insertPlacement =
      insertBuffer && normalizedInsertRegion
        ? {
            normalized: normalizedInsertRegion,
            pixels: {
              x: Math.round(normalizedInsertRegion.x * width),
              y: Math.round(normalizedInsertRegion.y * height),
              width: Math.round(normalizedInsertRegion.width * width),
              height: Math.round(normalizedInsertRegion.height * height),
            },
          }
        : null;

    const baseImage = await sharp(imageBuffer, {
      limitInputPixels: MAX_TOTAL_PIXELS,
    })
      .resize(width, height, { fit: "cover" })
      .ensureAlpha()
      .png()
      .toBuffer();

    const generatedImage = await sharp(generatedBuffer, {
      limitInputPixels: MAX_TOTAL_PIXELS,
    })
      .resize(width, height, { fit: "cover" })
      .ensureAlpha()
      .toBuffer();

    let finalBuffer: Buffer;

    if (maskBuffer) {
      const alphaChannel = await sharp(maskBuffer, {
        limitInputPixels: MAX_TOTAL_PIXELS,
      })
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

    const metadataDetails = {
      createdAt: new Date().toISOString(),
      prompt: prompt.trim(),
      negativePrompt:
        typeof negativePrompt === "string" && negativePrompt.trim()
          ? negativePrompt.trim()
          : null,
      guidanceScale,
      guidanceScaleInput:
        typeof guidanceScaleInput === "string" ? guidanceScaleInput : null,
      strength,
      strengthInput:
        typeof strengthInput === "string" ? strengthInput : null,
      inferenceSteps,
      inferenceStepsInput:
        typeof inferenceStepsInput === "string" ? inferenceStepsInput : null,
      seed: typeof seed === "number" ? seed : null,
      seedInput: typeof seedInput === "string" ? seedInput : null,
      temperature,
      modelId,
      apiBaseUrl,
      maskProvided: Boolean(maskBuffer),
      originalFilename:
        typeof image.name === "string" && image.name ? image.name : null,
      maskFilename:
        mask instanceof File && typeof mask.name === "string" && mask.name
          ? mask.name
          : null,
      insertReferenceProvided: Boolean(insertBuffer),
      insertReferenceContentType: insertContentType,
      insertReferenceFilename:
        insertImageFile &&
        typeof insertImageFile.name === "string" &&
        insertImageFile.name
          ? insertImageFile.name
          : null,
      insertPlacementNormalized: insertPlacement
        ? insertPlacement.normalized
        : null,
      insertPlacementPixels: insertPlacement ? insertPlacement.pixels : null,
    };

    const blobDocumentation = await documentImagesToBlob({
      input: { buffer: imageBuffer, contentType },
      mask: maskBuffer
        ? { buffer: maskBuffer, contentType: "image/png" }
        : undefined,
      output: { buffer: finalBuffer, contentType: "image/png" },
      metadata: metadataDetails,
    });

    return NextResponse.json({
      image: `data:image/png;base64,${finalBuffer.toString("base64")}`,
      blobs: blobDocumentation,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unexpected error while calling the image edit service." },
      { status: 500 },
    );
  }
}

function extractFirstImageUrl(
  payload: OpenRouterChatCompletionsResponse,
): string | null {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];

  for (const choice of choices) {
    const message = choice?.message;
    if (!message || typeof message !== "object") continue;

    const images = Array.isArray(message.images) ? message.images : [];
    const imageFromImages = images
      .map((image) => image?.image_url?.url)
      .find((url): url is string => typeof url === "string" && url.trim().length > 0);
    if (imageFromImages) {
      return imageFromImages;
    }

    const content = message.content;
    if (Array.isArray(content)) {
      const imageFromContent = content
        .map((part) => {
          if (!part || typeof part !== "object") return null;
          const typedPart = part as Record<string, unknown>;
          if (
            typedPart.type === "image_url" &&
            typeof (typedPart.image_url as { url?: string } | undefined)?.url === "string"
          ) {
            return (typedPart.image_url as { url?: string }).url ?? null;
          }
          if (
            typedPart.type === "output_image" &&
            typeof typedPart.b64_json === "string"
          ) {
            return `data:image/png;base64,${typedPart.b64_json}`;
          }
          return null;
        })
        .find((url): url is string => typeof url === "string" && url.trim().length > 0);

      if (imageFromContent) {
        return imageFromContent;
      }
    } else if (content && typeof content === "object") {
      const typedContent = content as Record<string, unknown>;
      if (
        typedContent.type === "image_url" &&
        typeof (typedContent.image_url as { url?: string } | undefined)?.url === "string"
      ) {
        const url = (typedContent.image_url as { url?: string }).url;
        if (typeof url === "string" && url.trim().length > 0) {
          return url;
        }
      }
      if (
        typedContent.type === "output_image" &&
        typeof typedContent.b64_json === "string"
      ) {
        return `data:image/png;base64,${typedContent.b64_json}`;
      }
    }
  }

  return null;
}

function parseDataUrl(
  value: string,
): { mimeType: string; base64Data: string } | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
    if (!match) return null;
    const [, mimeType, base64Data] = match;
    if (!base64Data) return null;
    return { mimeType, base64Data };
  }

  return {
    mimeType: "image/png",
    base64Data: trimmed,
  };
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

async function documentImagesToBlob({
  input,
  mask,
  output,
  metadata,
}: {
  input: { buffer: Buffer; contentType: string };
  mask?: { buffer: Buffer; contentType: string };
  output: { buffer: Buffer; contentType: string };
  metadata?: Record<string, unknown>;
}): Promise<BlobDocumentation | null> {
  if (!blobUploadsEnabled) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = randomUUID();
  const segments = [blobFolderPrefix];
  if (blobStoreId) {
    segments.push(blobStoreId);
  }
  segments.push(`${timestamp}-${sessionId}`);
  const sessionPath = segments.filter(Boolean).join("/");

  const uploads: Array<Promise<void>> = [];

  const documentation: BlobDocumentation = {
    sessionPath,
  };

  const enrichedMetadata =
    metadata !== undefined
      ? {
          ...metadata,
          sessionPath,
          sessionId,
          timestamp,
        }
      : undefined;

  if (enrichedMetadata) {
    documentation.details = enrichedMetadata;
  }

  uploads.push(
    uploadToBlob(
      `${sessionPath}/input${extensionFromContentType(input.contentType)}`,
      input.buffer,
      input.contentType,
    ).then((result) => {
      documentation.input = result;
    }),
  );

  if (mask) {
    uploads.push(
      uploadToBlob(
        `${sessionPath}/mask${extensionFromContentType(mask.contentType)}`,
        mask.buffer,
        mask.contentType,
      ).then((result) => {
        documentation.mask = result;
      }),
    );
  }

  uploads.push(
    uploadToBlob(
      `${sessionPath}/output${extensionFromContentType(output.contentType)}`,
      output.buffer,
      output.contentType,
    ).then((result) => {
      documentation.output = result;
    }),
  );

  if (enrichedMetadata) {
    const metadataBuffer = Buffer.from(
      JSON.stringify(enrichedMetadata, null, 2),
    );
    uploads.push(
      uploadToBlob(
        `${sessionPath}/metadata.json`,
        metadataBuffer,
        "application/json",
      ).then((result) => {
        documentation.metadata = result;
      }),
    );
  }

  await Promise.all(uploads);

  return documentation;
}

async function uploadToBlob(
  pathname: string,
  data: Buffer,
  contentType: string,
): Promise<BlobSummary | null> {
  try {
    const result = await put(pathname, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
      token: blobToken ?? undefined,
    });

    const finalUrl = blobBaseUrl
      ? `${blobBaseUrl}/${result.pathname}`
      : result.url;
    const finalDownloadUrl = blobBaseUrl
      ? `${blobBaseUrl}/${result.pathname}`
      : result.downloadUrl;

    return {
      pathname: result.pathname,
      url: finalUrl,
      downloadUrl: finalDownloadUrl ?? null,
      contentType: result.contentType ?? null,
    };
  } catch (error) {
    console.error(`Failed to upload ${pathname} to Vercel Blob.`, error);
    return null;
  }
}

function extensionFromContentType(
  contentType: string | null | undefined,
): string {
  if (!contentType) return ".png";
  const normalized = contentType.toLowerCase();
  if (normalized.includes("jpeg")) return ".jpg";
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  if (normalized.includes("bmp")) return ".bmp";
  if (normalized.includes("tiff")) return ".tif";
  const match = normalized.match(/\/([a-z0-9.+-]+)/);
  if (match) {
    return `.${match[1]}`;
  }
  return ".png";
}
