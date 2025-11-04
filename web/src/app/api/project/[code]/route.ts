import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";

const ALLOWED_CODE = /^[A-Za-z0-9._-]+$/;
const projectsPortalView =
  process.env.SUPABASE_PROJECTS_PORTAL_VIEW?.trim() || "project_portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = Record<string, string | string[] | undefined>;

type ProjectRow = Record<string, unknown> & {
  public_code?: string | null;
};

function normalizeProjectRow(row: ProjectRow): Record<string, unknown> {
  const cleaned = { ...row };

  if (typeof cleaned.total_cost_cents === "number") {
    cleaned.total_cost = cleaned.total_cost_cents / 100;
  }

  if (
    typeof cleaned.square_invoice_url === "string" &&
    !cleaned.invoice_url
  ) {
    cleaned.invoice_url = cleaned.square_invoice_url;
  }

  if (
    typeof cleaned.square_invoice_id === "string" &&
    !cleaned.invoice_id
  ) {
    cleaned.invoice_id = cleaned.square_invoice_id;
  }

  return cleaned;
}

export async function GET(
  _request: Request,
  context: { params: Promise<RouteParams> },
) {
  const resolvedParams = await context.params;
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

  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from(projectsPortalView)
    .select("*")
    .eq("public_code", normalizedCode)
    .maybeSingle();

  if (error) {
    console.error("Supabase project lookup failed", error);
    return NextResponse.json(
      { error: "We were unable to fetch project information. Try again shortly." },
      { status: 502 },
    );
  }

  const project = (data ?? null) as ProjectRow | null;

  if (!project) {
    return NextResponse.json(
      { error: "We couldn't find a project with that code." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: normalizeProjectRow(project),
  });
}
