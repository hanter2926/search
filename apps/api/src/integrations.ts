import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Redis from "ioredis";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const redisUrl = process.env.REDIS_URL;

export const persistenceMode = supabaseUrl && supabaseKey ? "supabase" : "local";
export const supabase: SupabaseClient | undefined = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : undefined;

let redis: Redis | undefined;
if (redisUrl) {
  redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
}

export async function integrationHealth(): Promise<{
  redis: "connected" | "not_configured" | "unavailable";
  email: "configured" | "not_configured" | "unavailable";
}> {
  let redisStatus: "connected" | "not_configured" | "unavailable" = "not_configured";
  if (redis) {
    try {
      if (redis.status === "wait") await redis.connect();
      await redis.ping();
      redisStatus = "connected";
    } catch {
      redisStatus = "unavailable";
    }
  }
  const smtp = process.env.SMTP_URL;
  return {
    redis: redisStatus,
    email: smtp ? "configured" : "not_configured"
  };
}

export async function verifySupabase(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" });
  return !error;
}

export function redisClient(): Redis | undefined {
  return redis;
}
