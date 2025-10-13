import { NextResponse } from "next/server";

type ShoppingRequestBody = {
  keywords?: string;
  limit?: number;
};

type SerpShoppingResult = {
  title?: string;
  link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  image?: string;
  shipping?: string;
  position?: number;
};

const SERP_ENDPOINT = "https://serpapi.com/search.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const serpApiKey = process.env.SERPAPI_KEY?.trim();
  if (!serpApiKey) {
    return NextResponse.json(
      { error: "SERPAPI_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: ShoppingRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body provided." },
      { status: 400 },
    );
  }

  const rawKeywords =
    typeof body.keywords === "string" ? body.keywords.trim() : "";

  if (!rawKeywords) {
    return NextResponse.json(
      { error: "Provide a non-empty keywords string." },
      { status: 400 },
    );
  }

  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.max(1, Math.floor(body.limit))
      : undefined;

  const params = new URLSearchParams({
    engine: "google_shopping",
    api_key: serpApiKey,
    q: rawKeywords,
  });

  if (process.env.SERPAPI_GL) params.set("gl", process.env.SERPAPI_GL);
  if (process.env.SERPAPI_HL) params.set("hl", process.env.SERPAPI_HL);
  if (process.env.SERPAPI_LOCATION)
    params.set("location", process.env.SERPAPI_LOCATION);
  if (limit) params.set("num", String(limit));

  try {
    const response = await fetch(`${SERP_ENDPOINT}?${params.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: text
            ? `SerpAPI request failed: ${text.slice(0, 200)}`
            : `SerpAPI request failed with status ${response.status}`,
        },
        { status: response.status },
      );
    }

    const json = await response.json();
    const shoppingResults: SerpShoppingResult[] = Array.isArray(
      json?.shopping_results,
    )
      ? json.shopping_results
      : [];

    const items = shoppingResults
      .map((item) => {
        const thumbnail =
          item.thumbnail ||
          item.serpapi_thumbnail ||
          item.image ||
          null;
        const linkCandidate =
          typeof item.link === "string"
            ? item.link
            : typeof (item as Record<string, unknown>).product_link === "string"
              ? ((item as Record<string, unknown>)
                  .product_link as string)
              : null;
        const title =
          typeof item.title === "string" ? item.title.trim() : "";

        if (!title || !linkCandidate) return null;

        return {
          title,
          link: linkCandidate,
          source: item.source ?? null,
          price: item.price ?? null,
          extractedPrice:
            typeof item.extracted_price === "number"
              ? item.extracted_price
              : null,
          thumbnail: typeof thumbnail === "string" ? thumbnail : null,
          shipping: item.shipping ?? null,
          position: typeof item.position === "number" ? item.position : null,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    return NextResponse.json({ results: items });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while contacting SerpAPI.",
      },
      { status: 500 },
    );
  }
}
