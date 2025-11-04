import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";

const requestsTable =
  process.env.SUPABASE_REQUESTS_TABLE?.trim() || "requests";
const projectsTable =
  process.env.SUPABASE_PROJECTS_TABLE?.trim() || "projects";

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

  const origin = request.headers.get("origin")?.trim() ?? undefined;
  const referer = request.headers.get("referer")?.trim() ?? undefined;
  const userAgent = request.headers.get("user-agent")?.trim() ?? undefined;

  const supabase = getServerSupabaseClient();
  const submittedAt = new Date().toISOString();

  const insertPayload: Record<string, unknown> = {
    name: trimmedName,
    customer_name: trimmedCustomerName,
    email: trimmedEmail,
    phone: trimmedPhone || null,
    description: trimmedDescription || null,
    project_code: trimmedProjectCode || null,
    session_id: trimmedSessionId || null,
    submitted_at: submittedAt,
    origin: origin || null,
    referer: referer || null,
    user_agent: userAgent || null,
    payload: sanitizedPayload,
  };

  const { error } = await supabase.from(requestsTable).insert(insertPayload);

  if (error) {
    console.error("Supabase insert failed for request submission", error);
    return NextResponse.json(
      {
        message:
          "We couldn't submit your request right now. Please try again shortly.",
      },
      { status: 502 },
    );
  }

  if (trimmedProjectCode) {
    const { error: projectUpdateError } = await supabase
      .from(projectsTable)
      .update({
        last_request_at: submittedAt,
        last_request_name: trimmedName,
        last_request_email: trimmedEmail,
      })
      .eq("public_code", trimmedProjectCode);

    if (projectUpdateError) {
      console.warn(
        "Unable to update project metadata after request submission",
        projectUpdateError,
      );
    }
  }

  return NextResponse.json({
    message: "Request sent! We'll be in touch soon.",
  });
}
