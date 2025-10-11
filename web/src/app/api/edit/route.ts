import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: Request) {
  if (!process.env.HUGGING_FACE_API_KEY) {
    return NextResponse.json(
      { error: "HUGGING_FACE_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const prompt = formData.get("prompt");
  const image = formData.get("image");
  const negativePrompt = formData.get("negativePrompt");
  const guidanceScaleInput = formData.get("guidanceScale");
  const strengthInput = formData.get("strength");
  const seedInput = formData.get("seed");
  const trueCfgScaleInput = formData.get("trueCfgScale");
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
  const base64Input = imageBuffer.toString("base64");
  const contentType = image.type || "image/png";
  const modelId =
    process.env.HUGGING_FACE_MODEL ?? "Qwen/Qwen-Image-Edit-2509";
  const guidanceScale = clampNumber(parseNumber(guidanceScaleInput, 1.0), 0.5, 5);
  const strength = clampNumber(parseNumber(strengthInput, 0.35), 0.05, 0.95);
  const trueCfgScale = clampNumber(parseNumber(trueCfgScaleInput, 4.0), 1, 10);
  const inferenceSteps = clampInteger(parseNumber(inferenceStepsInput, 40), 10, 60);
  const parsedSeed = parseNumber(seedInput, Number.NaN);
  const seed = Number.isFinite(parsedSeed) ? Math.floor(parsedSeed) : null;

  const payload: QwenImageEditPayload = {
    inputs: {
      prompt: prompt.trim(),
      image: [`data:${contentType};base64,${base64Input}`],
    },
    parameters: {
      guidance_scale: guidanceScale,
      strength,
      true_cfg_scale: trueCfgScale,
      num_inference_steps: inferenceSteps,
    },
    options: {
      wait_for_model: true,
      use_gpu: true,
    },
  };

  if (typeof negativePrompt === "string" && negativePrompt.trim()) {
    payload.parameters.negative_prompt = negativePrompt.trim();
  }

  if (seed !== null && Number.isFinite(seed)) {
    payload.parameters.seed = seed;
  }

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${modelId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      return NextResponse.json(
        {
          error:
            errorPayload?.error ??
            errorPayload?.message ??
            `Image edit failed with status ${response.status}`,
        },
        { status: response.status },
      );
    }

    const responseType = response.headers.get("content-type") ?? "";
    if (responseType.includes("application/json")) {
      const errorPayload = await response.json();
      return NextResponse.json(
        {
          error:
            errorPayload?.error ??
            errorPayload?.message ??
            "The Hugging Face model returned an unexpected response.",
        },
        { status: 502 },
      );
    }

    const responseArrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(responseArrayBuffer).toString("base64");
    const outputType = responseType || "image/png";

    return NextResponse.json({
      image: `data:${outputType};base64,${base64Image}`,
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
    return await response.json();
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

type QwenImageEditPayload = {
  inputs: {
    prompt: string;
    image: string[];
  };
  parameters: {
    guidance_scale: number;
    strength: number;
    true_cfg_scale: number;
    num_inference_steps: number;
    negative_prompt?: string;
    seed?: number;
  };
  options: {
    wait_for_model: boolean;
    use_gpu?: boolean;
  };
};
