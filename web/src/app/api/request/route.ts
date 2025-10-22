import { NextResponse } from "next/server";

const FALLBACK_WEBHOOK_URL =
  "https://deckd.app.n8n.cloud/webhook/04a63e4d-c10e-48c0-ba40-a37d8a7688ac";

const webhookUrl =
  process.env.N8N_WEBHOOK_URL?.trim() || FALLBACK_WEBHOOK_URL;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Invalid JSON in request payload", error);
    return NextResponse.json(
      { message: "Invalid JSON body provided." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "n8n webhook responded with an error",
        response.status,
        errorBody,
      );
      return NextResponse.json(
        {
          message:
            "We couldn't submit your request right now. Please try again shortly.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ message: "Request forwarded successfully." });
  } catch (error) {
    console.error("Failed to reach n8n webhook", error);
    return NextResponse.json(
      {
        message:
          "We couldn't submit your request right now. Please try again shortly.",
      },
      { status: 502 },
    );
  }
}
