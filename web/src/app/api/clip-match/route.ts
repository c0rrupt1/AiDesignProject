import { NextResponse } from "next/server";

type ClipRequestBody = {
  referenceImage?: string;
  candidateImages?: string[];
  limit?: number;
};

type ClipResult = {
  url: string;
  score: number;
};

type TransformersModule = typeof import("@xenova/transformers");
type RawImageConstructor = TransformersModule["RawImage"];

type ClipExtractor = {
  pipeline: InstanceType<
    TransformersModule["ImageFeatureExtractionPipeline"]
  >;
  RawImage: RawImageConstructor;
};

let pipelinePromise: Promise<ClipExtractor> | null = null;

async function getClipExtractor(): Promise<ClipExtractor> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const transformers = await import("@xenova/transformers");
      const pipeline = await transformers.pipeline(
        "image-feature-extraction",
        "Xenova/clip-vit-base-patch32",
      );
      return { pipeline, RawImage: transformers.RawImage };
    })();
  }
  return pipelinePromise;
}

function ensureDataUrl(value: string): Blob {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("referenceImage must be a base64 data URL.");
  }
  const [, mimeType, payload] = match;
  const buffer = Buffer.from(payload, "base64");
  return new Blob([buffer], { type: mimeType || "application/octet-stream" });
}

async function blobFromSource(url: string): Promise<Blob> {
  if (!url) {
    throw new Error("Encountered empty candidate image URL.");
  }
  if (url.startsWith("data:")) {
    return ensureDataUrl(url);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch candidate image (${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/png";
  return new Blob([arrayBuffer], { type: contentType });
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error("Embedding vectors must have the same length.");
  }
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += a[i] * b[i];
  }
  return total;
}

async function embeddingFor(
  extractor: ClipExtractor,
  source: Blob,
): Promise<Float32Array> {
  const image = await extractor.RawImage.fromBlob(source);
  const tensor = await extractor.pipeline(image);
  const raw = Float32Array.from(tensor.data as ArrayLike<number>);
  const dims = Array.isArray(tensor.dims) ? tensor.dims : [];
  const hiddenSize = dims.length > 0 ? dims[dims.length - 1] : raw.length;

  let embedding: Float32Array;
  if (
    hiddenSize > 0 &&
    raw.length > hiddenSize &&
    Number.isInteger(raw.length / hiddenSize)
  ) {
    const steps = raw.length / hiddenSize;
    embedding = new Float32Array(hiddenSize);
    for (let step = 0; step < steps; step += 1) {
      const offset = step * hiddenSize;
      for (let i = 0; i < hiddenSize; i += 1) {
        embedding[i] += raw[offset + i];
      }
    }
    for (let i = 0; i < hiddenSize; i += 1) {
      embedding[i] /= steps;
    }
  } else {
    embedding = raw;
  }

  let norm = 0;
  for (let i = 0; i < embedding.length; i += 1) {
    norm += embedding[i] * embedding[i];
  }
  const magnitude = Math.sqrt(norm);
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i += 1) {
      embedding[i] /= magnitude;
    }
  }
  return embedding;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: ClipRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body provided." },
      { status: 400 },
    );
  }

  const referenceImage =
    typeof body.referenceImage === "string" ? body.referenceImage.trim() : "";
  const candidateImages = Array.isArray(body.candidateImages)
    ? body.candidateImages.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];

  if (!referenceImage) {
    return NextResponse.json(
      { error: "referenceImage must be provided as a base64 data URL." },
      { status: 400 },
    );
  }

  if (candidateImages.length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide at least one candidate image URL or data URL to compare.",
      },
      { status: 400 },
    );
  }

  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.max(1, Math.floor(body.limit))
      : undefined;

  const trimmedCandidates =
    typeof limit === "number"
      ? candidateImages.slice(0, limit)
      : candidateImages;

  try {
    const extractor = await getClipExtractor();
    const referenceBlob = ensureDataUrl(referenceImage);
    const referenceEmbedding = await embeddingFor(extractor, referenceBlob);

    const scores: ClipResult[] = [];

    for (const url of trimmedCandidates) {
      try {
        const candidateBlob = await blobFromSource(url);
        const candidateEmbedding = await embeddingFor(
          extractor,
          candidateBlob,
        );
        const score = dotProduct(referenceEmbedding, candidateEmbedding);
        scores.push({ url, score });
      } catch (error) {
        console.error(`Failed to process candidate image ${url}`, error);
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return NextResponse.json({ results: scores });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while ranking images.",
      },
      { status: 500 },
    );
  }
}
