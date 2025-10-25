import { NextResponse } from "next/server";

const lookupBaseUrl = process.env.N8N_PROJECT_LOOKUP_URL?.trim() ?? "";
const REQUEST_TIMEOUT_MS = 10000;

const ALLOWED_CODE = /^[A-Za-z0-9._-]+$/;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = Record<string, string | string[] | undefined>;

export async function GET(
  _request: Request,
  context: { params: Promise<RouteParams> | RouteParams },
) {
  if (!lookupBaseUrl) {
    return NextResponse.json(
      {
        error:
          "N8N_PROJECT_LOOKUP_URL is not configured on the server. Set it to your n8n lookup webhook.",
      },
      { status: 500 },
    );
  }

  const resolvedParams = await Promise.resolve(context.params);
  const rawCodeCandidate = resolvedParams.code;
  const rawCode = Array.isArray(rawCodeCandidate)
    ? rawCodeCandidate[0] ?? ""
    : rawCodeCandidate ?? "";
  const normalizedCode = rawCode.trim();

  if (!normalizedCode) {
    return NextResponse.json(
      { error: "Provide a project code in the request URL." },
      { status: 400 },
    );
  }

  if (!ALLOWED_CODE.test(normalizedCode)) {
    return NextResponse.json(
      {
        error:
          "Project code contains unsupported characters. Use letters, numbers, dashes, dots, or underscores.",
      },
      { status: 400 },
    );
  }

  let targetUrl: string;
  try {
    if (lookupBaseUrl.includes("{code}")) {
      targetUrl = lookupBaseUrl.replace("{code}", encodeURIComponent(normalizedCode));
    } else {
      const url = new URL(lookupBaseUrl);
      url.searchParams.set("code", normalizedCode);
      targetUrl = url.toString();
    }
  } catch (error) {
    console.error("Failed to construct the n8n lookup URL.", error);
    return NextResponse.json(
      { error: "The lookup service URL is misconfigured on the server." },
      { status: 500 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });

    const rawBody = await response.text();

    if (!response.ok) {
      let errorMessage = rawBody.trim();
      if (!errorMessage) {
        errorMessage = `Lookup failed with status ${response.status}`;
      }
      return NextResponse.json(
        {
          error: errorMessage,
          status: response.status,
        },
        { status: response.status },
      );
    }

    if (!rawBody) {
      return NextResponse.json({ data: null, raw: "" });
    }

    try {
      const parsed = JSON.parse(rawBody);
      return NextResponse.json({ data: parsed });
    } catch {
      return NextResponse.json({ data: rawBody });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Lookup timed out while contacting the n8n workflow." },
        { status: 504 },
      );
    }
    console.error("Failed to lookup project code via n8n.", error);
    return NextResponse.json(
      { error: "We were unable to fetch project information. Try again shortly." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
