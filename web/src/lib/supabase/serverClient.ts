import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type CachedClient = {
  client: SupabaseClient;
  url: string;
  serviceRoleKey: string;
};

let cached: CachedClient | null = null;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value.trim();
}

export function getServerSupabaseClient(): SupabaseClient {
  const url = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (cached && cached.url === url && cached.serviceRoleKey === serviceRoleKey) {
    return cached.client;
  }

  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  cached = { client, url, serviceRoleKey };
  return client;
}
