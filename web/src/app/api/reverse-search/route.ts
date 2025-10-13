/// <reference types="undici-types" />

import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { ProxyAgent } from "undici";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type NormalizedCrop = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const GOOGLE_UPLOAD_URL = "https://www.google.com/searchbyimage/upload";
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};
const DEFAULT_PROXY_API =
  "https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all&skip=0&limit=2000";

async function pickProxyEndpoint(): Promise<string | null> {
  const staticList = process.env.REVERSE_SEARCH_PROXIES;
  if (staticList) {
    const entries = staticList
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.length > 0) {
      const chosen =
        entries[Math.floor(Math.random() * entries.length)];
      return normalizeProxyUrl(chosen);
    }
  }

  const apiEndpoint =
    process.env.REVERSE_SEARCH_PROXY_API?.trim() ?? DEFAULT_PROXY_API;
  if (apiEndpoint) {
    try {
      const apiResponse = await fetch(apiEndpoint);
      if (apiResponse.ok) {
        const text = await apiResponse.text();
        const candidates = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        if (candidates.length > 0) {
          const candidate =
            candidates[Math.floor(Math.random() * candidates.length)];
          return normalizeProxyUrl(candidate);
        }
      } else {
        console.warn(
          `Proxy API responded with ${apiResponse.status} ${apiResponse.statusText}`,
        );
      }
    } catch (error) {
      console.warn("Failed to fetch proxy list from API:", error);
    }
  }

  const singleProxy = process.env.REVERSE_SEARCH_PROXY?.trim();
  return singleProxy ? normalizeProxyUrl(singleProxy) : null;
}

function normalizeProxyUrl(value: string): string {
  if (!value.includes("://")) {
    return `http://${value}`;
  }
  return value;
}

type ProxyAwareRequestInit = RequestInit & { dispatcher?: unknown };

async function proxyFetch(input: RequestInfo | URL, init?: RequestInit) {
  const proxyUrl = await pickProxyEndpoint();
  if (proxyUrl) {
    const agent = new ProxyAgent(proxyUrl);
    const proxyInit: ProxyAwareRequestInit = {
      ...(init ?? {}),
      dispatcher: agent,
    };
    return fetch(input, proxyInit);
  }
  return fetch(input, init);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required for reverse image search." },
        { status: 400 },
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const cropRect = parseCropRect(
      formData.get("cropLeft"),
      formData.get("cropTop"),
      formData.get("cropWidth"),
      formData.get("cropHeight"),
    );

    const croppedBuffer = await cropToRegion(imageBuffer, cropRect);

    try {
      const providerUrl = await uploadToGoogle(croppedBuffer);
      return NextResponse.json(
        {
          providerUrl,
        },
        { status: 200 },
      );
    } catch (error) {
      if (
        error instanceof Error &&
        (error as Error & { code?: string }).code === "GOOGLE_TEMP_UNAVAILABLE"
      ) {
        return NextResponse.json(
          {
            error:
              "Google reverse image search is temporarily unavailable. Please wait and try again.",
          },
          { status: 503 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while processing the request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function cropToRegion(
  imageBuffer: Buffer,
  cropRect: NormalizedCrop | null,
): Promise<Buffer> {
  if (!cropRect) {
    return sharp(imageBuffer).png().toBuffer();
  }

  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? metadata.height ?? 1024;
  const height = metadata.height ?? metadata.width ?? 1024;

  const leftPx = clamp(Math.round(cropRect.left * width), 0, Math.max(width - 1, 0));
  const topPx = clamp(Math.round(cropRect.top * height), 0, Math.max(height - 1, 0));
  const cropWidthPx = Math.max(1, Math.round(cropRect.width * width));
  const cropHeightPx = Math.max(1, Math.round(cropRect.height * height));
  const boundedWidth = Math.max(1, Math.min(cropWidthPx, width - leftPx));
  const boundedHeight = Math.max(1, Math.min(cropHeightPx, height - topPx));

  return sharp(imageBuffer)
    .extract({
      left: leftPx,
      top: topPx,
      width: boundedWidth,
      height: boundedHeight,
    })
    .png()
    .toBuffer();
}

async function uploadToGoogle(imageBuffer: Buffer): Promise<string> {
  const form = new FormData();
  const blobSource = Uint8Array.from(imageBuffer);

  form.set("encoded_image", new Blob([blobSource], { type: "image/png" }), "crop.png");
  form.set("image_content", "");
  form.set("hl", "en");

  const response = await proxyFetch(GOOGLE_UPLOAD_URL, {
    method: "POST",
    body: form,
    redirect: "manual",
    headers: DEFAULT_HEADERS,
  });

  if (response.status >= 400) {
    throw new Error(
      `Google rejected the reverse image upload (status ${response.status}).`,
    );
  }

  const location =
    response.headers.get("location") ?? response.headers.get("Location");

  if (location) {
    return normalizeProviderUrl(location);
  }

  const html = await response.text();
  if (isTemporarilyUnavailable(html)) {
    const error = new Error("Google temporarily disabled reverse image search.");
    (error as Error & { code?: string }).code = "GOOGLE_TEMP_UNAVAILABLE";
    throw error;
  }

  // Occasionally Google returns a 200 page with a meta refresh or link.
  const redirectedUrl = extractFirstResultUrl(html);
  if (redirectedUrl) {
    return normalizeProviderUrl(redirectedUrl);
  }

  throw new Error("Upload succeeded but no results URL was returned.");
}

function extractFirstResultUrl(html: string): string | null {
  const match = html.match(/https?:\/\/lens\.google\.com[^\s"'<>]*/i);
  if (match) return match[0];
  return null;
}

function normalizeProviderUrl(url: string): string {
  try {
    return new URL(url, "https://www.google.com").toString();
  } catch {
    return url;
  }
}

function parseCropRect(
  left: FormDataEntryValue | null,
  top: FormDataEntryValue | null,
  width: FormDataEntryValue | null,
  height: FormDataEntryValue | null,
): NormalizedCrop | null {
  const leftValue = parseFloatInput(left);
  const topValue = parseFloatInput(top);
  const widthValue = parseFloatInput(width);
  const heightValue = parseFloatInput(height);

  if (
    leftValue === null ||
    topValue === null ||
    widthValue === null ||
    heightValue === null
  ) {
    return null;
  }

  const normalizedLeft = clamp(leftValue, 0, 1);
  const normalizedTop = clamp(topValue, 0, 1);
  const normalizedWidth = clamp(widthValue, 0, 1);
  const normalizedHeight = clamp(heightValue, 0, 1);

  if (normalizedWidth <= 0 || normalizedHeight <= 0) {
    return null;
  }

  const adjustedWidth = Math.min(normalizedWidth, 1 - normalizedLeft);
  const adjustedHeight = Math.min(normalizedHeight, 1 - normalizedTop);

  if (adjustedWidth <= 0 || adjustedHeight <= 0) {
    return null;
  }

  return {
    left: normalizedLeft,
    top: normalizedTop,
    width: adjustedWidth,
    height: adjustedHeight,
  };
}

function parseFloatInput(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}

function isTemporarilyUnavailable(html: string): boolean {
  const normalized = html.toLowerCase();
  return (
    normalized.includes("search by image is unavailable") ||
    normalized.includes("try again in a few hours")
  );
}
