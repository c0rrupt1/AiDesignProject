import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeApiVersion =
  (process.env.STRIPE_API_VERSION as Stripe.LatestApiVersion | undefined) ??
  "2024-06-20";
const defaultReturnUrlTemplate =
  process.env.STRIPE_PORTAL_RETURN_URL?.trim() ?? undefined;
const defaultConfigurationId =
  process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() ?? undefined;

const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: stripeApiVersion,
    })
  : null;

type PortalRequestBody = {
  customerId?: unknown;
  returnUrl?: unknown;
  configurationId?: unknown;
  projectCode?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!stripeClient) {
    console.error("Stripe customer portal requested but STRIPE_SECRET_KEY is not configured.");
    return NextResponse.json(
      { error: "Stripe is not configured on this server." },
      { status: 500 },
    );
  }

  let body: PortalRequestBody;
  try {
    body = (await request.json()) as PortalRequestBody;
  } catch (error) {
    console.error("Invalid JSON payload for Stripe portal session.", error);
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON." },
      { status: 400 },
    );
  }

  const customerId =
    typeof body.customerId === "string" ? body.customerId.trim() : "";
  if (!customerId) {
    return NextResponse.json(
      { error: "A Stripe customer ID is required." },
      { status: 400 },
    );
  }

  if (!/^cus_[A-Za-z0-9]+$/.test(customerId)) {
    return NextResponse.json(
      { error: "The provided value does not appear to be a Stripe customer ID." },
      { status: 400 },
    );
  }

  const projectCode =
    typeof body.projectCode === "string" ? body.projectCode.trim() : "";
  const origin = request.headers.get("origin")?.trim() ?? "";

  const applyCodePlaceholder = (url: string): string => {
    if (!url.includes("{code}")) {
      return url;
    }
    const encodedCode = projectCode ? encodeURIComponent(projectCode) : "";
    return url.replace("{code}", encodedCode);
  };

  const incomingReturnUrl =
    typeof body.returnUrl === "string" ? body.returnUrl.trim() : "";
  let resolvedReturnUrl: string | undefined = undefined;

  if (defaultReturnUrlTemplate) {
    resolvedReturnUrl = applyCodePlaceholder(defaultReturnUrlTemplate);
  } else if (incomingReturnUrl && origin && incomingReturnUrl.startsWith(origin)) {
    resolvedReturnUrl = applyCodePlaceholder(incomingReturnUrl);
  } else if (origin) {
    const codeFragment = projectCode ? `?code=${encodeURIComponent(projectCode)}` : "";
    resolvedReturnUrl = `${origin}/lookup${codeFragment}`;
  }

  const configurationId =
    typeof body.configurationId === "string" && body.configurationId.trim()
      ? body.configurationId.trim()
      : defaultConfigurationId;

  try {
    const session = await stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: resolvedReturnUrl,
      configuration: configurationId,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Unable to create Stripe customer portal session.", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to start the Stripe customer portal.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

