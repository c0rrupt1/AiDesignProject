import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSupabaseClient } from "@/lib/supabase/serverClient";

const uploadsBucket =
  process.env.SUPABASE_UPLOADS_BUCKET?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET?.trim() ||
  "client_uploads";

const MAX_FILE_SIZE_BYTES = Number(
  process.env.SUPABASE_MAX_UPLOAD_BYTES?.trim() ?? 25 * 1024 * 1024,
);

type UploadRequestBody = {
  fileName?: unknown;
  contentType?: unknown;
  fileSize?: unknown;
};

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim().slice(0, 180);
  const replaced = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return replaced || "upload";
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { message: "Missing or invalid authorization header." },
      { status: 401 },
    );
  }

  const accessToken = authHeader.slice("bearer ".length).trim();
  if (!accessToken) {
    return NextResponse.json(
      { message: "Provide an access token to request upload URLs." },
      { status: 401 },
    );
  }

  let payload: UploadRequestBody;
  try {
    payload = (await request.json()) as UploadRequestBody;
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const fileNameRaw =
    typeof payload.fileName === "string" ? payload.fileName : "";
  const contentTypeRaw =
    typeof payload.contentType === "string" ? payload.contentType : "";
  const fileSizeValue =
    typeof payload.fileSize === "number"
      ? payload.fileSize
      : typeof payload.fileSize === "string"
        ? Number.parseInt(payload.fileSize, 10)
        : NaN;

  if (!fileNameRaw) {
    return NextResponse.json(
      { message: "Provide the original file name." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(fileSizeValue) || fileSizeValue <= 0) {
    return NextResponse.json(
      { message: "Provide the file size in bytes." },
      { status: 400 },
    );
  }

  if (fileSizeValue > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        message: `Uploads are limited to ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB per file.`,
      },
      { status: 413 },
    );
  }

  const supabase = getServerSupabaseClient();

  const { data: userResult, error: userError } =
    await supabase.auth.getUser(accessToken);

  if (userError || !userResult?.user) {
    console.error("Failed to validate Supabase user for upload URL", userError);
    return NextResponse.json(
      { message: "Unauthorized request." },
      { status: 401 },
    );
  }

  const user = userResult.user;
  const sanitized = sanitizeFileName(fileNameRaw);
  const extension = sanitized.includes(".")
    ? sanitized.slice(sanitized.lastIndexOf("."))
    : "";
  const uniqueSuffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const objectPath = `${user.id}/${uniqueSuffix}${extension}`;

  const { data, error } = await supabase.storage
    .from(uploadsBucket)
    .createSignedUploadUrl(objectPath, {
      upsert: false,
    });

  if (error || !data?.signedUrl) {
    console.error("Failed to create signed upload URL", error);
    return NextResponse.json(
      {
        message:
          "We couldn't prepare the upload right now. Please try again in a moment.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    path: data.path ?? objectPath,
    bucket: uploadsBucket,
    contentType: contentTypeRaw || null,
    token: data.token ?? null,
  });
}
