"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function resolveEnv(name: string, fallback?: string): string {
  const raw = process.env[name];
  if (raw && raw.trim().length > 0) {
    return raw.trim();
  }
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }
  throw new Error(`Missing required environment variable ${name}.`);
}

export function getBrowserSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const url = resolveEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.SUPABASE_URL);
  const anonKey = resolveEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.SUPABASE_ANON_KEY,
  );

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cachedClient;
}
