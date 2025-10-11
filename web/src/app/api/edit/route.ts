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
  const mask = formData.get("mask");

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

  if (mask instanceof File) {
    return NextResponse.json(
      {
        error:
          "Mask-based edits are not supported with the current Hugging Face model.",
      },
      { status: 400 },
    );
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const base64Input = imageBuffer.toString("base64");
  const contentType = image.type || "image/png";
  const modelId =
    process.env.HUGGING_FACE_MODEL ?? "stabilityai/stable-diffusion-xl-base-1.0";

  const payload = {
    inputs: prompt.trim(),
    image: `data:${contentType};base64,${base64Input}`,
    parameters: {
      guidance_scale: 7.5,
      strength: 0.65,
    },
    options: {
      wait_for_model: true,
      use_gpu: true,
    },
  };

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
