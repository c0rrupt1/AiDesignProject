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

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json(
      {
        message: "Invalid request body: expected a JSON object.",
      },
      { status: 400 },
    );
  }

  const {
    name,
    customerName,
    email,
    phone,
    description,
    projectCode: projectCodeValue,
    code,
    sessionId: sessionIdValue,
  } = payload as Record<
    string,
    unknown
  >;

  const isNonEmptyString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;

  if (!isNonEmptyString(name) || !isNonEmptyString(customerName) || !isNonEmptyString(email)) {
    return NextResponse.json(
      {
        message: "Name, contact name, and email are required.",
      },
      { status: 400 },
    );
  }

  const trimmedName = name.trim();
  const trimmedCustomerName = customerName.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = isNonEmptyString(phone) ? phone.trim() : "";
  const trimmedDescription = isNonEmptyString(description)
    ? description.trim()
    : "";
  const trimmedProjectCode = isNonEmptyString(projectCodeValue)
    ? projectCodeValue.trim()
    : isNonEmptyString(code)
      ? code.trim()
      : "";
  const trimmedSessionId = isNonEmptyString(sessionIdValue)
    ? sessionIdValue.trim()
    : "";

  const sanitizedPayload: Record<string, string> = {
    name: trimmedName,
    Name: trimmedName,
    projectName: trimmedName,
    "Project Name": trimmedName,
    customerName: trimmedCustomerName,
    "Customer Name": trimmedCustomerName,
    contactName: trimmedCustomerName,
    email: trimmedEmail,
    Email: trimmedEmail,
    submittedAt: new Date().toISOString(),
    source: "website-request-form",
  };

  if (trimmedProjectCode) {
    sanitizedPayload.projectCode = trimmedProjectCode;
    sanitizedPayload.ProjectCode = trimmedProjectCode;
    sanitizedPayload.code = trimmedProjectCode;
    sanitizedPayload.Code = trimmedProjectCode;
    sanitizedPayload.publicCode = trimmedProjectCode;
    sanitizedPayload.PublicCode = trimmedProjectCode;
  }

  if (trimmedSessionId) {
    sanitizedPayload.sessionId = trimmedSessionId;
    sanitizedPayload.SessionId = trimmedSessionId;
  }

  if (trimmedPhone) {
    sanitizedPayload.phone = trimmedPhone;
    sanitizedPayload.Phone = trimmedPhone;
  }

  if (trimmedDescription) {
    sanitizedPayload.description = trimmedDescription;
    sanitizedPayload.Description = trimmedDescription;
    sanitizedPayload.notes = trimmedDescription;
  }

  const origin = request.headers.get("origin")?.trim();
  if (origin) {
    sanitizedPayload.origin = origin;
  }

  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    sanitizedPayload.referer = referer;
  }

  const userAgent = request.headers.get("user-agent")?.trim();
  if (userAgent) {
    sanitizedPayload.userAgent = userAgent;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sanitizedPayload),
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeout);
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "n8n webhook responded with an error",
        response.status,
        errorBody,
      );

      let message = "We couldn't submit your request right now. Please try again shortly.";

      try {
        const parsed = JSON.parse(errorBody);
        if (
          parsed &&
          typeof parsed === "object" &&
          "message" in parsed &&
          typeof parsed.message === "string" &&
          parsed.message.trim()
        ) {
          message = parsed.message.trim();
        }
      } catch (parseError) {
        console.error("Unable to parse error body from n8n", parseError);
      }

      return NextResponse.json({ message }, { status: 502 });
    }

    const successBody = await response.json().catch(() => null);
    const successMessage =
      successBody &&
      typeof successBody === "object" &&
      "message" in successBody &&
      typeof successBody.message === "string"
        ? successBody.message
        : "Request sent! We'll be in touch soon.";

    return NextResponse.json({ message: successMessage });
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
