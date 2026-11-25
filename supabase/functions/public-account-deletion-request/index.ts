import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://masterminds08.vercel.app",
  "http://localhost:5173",
]);

const responseHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
    ? origin
    : "https://masterminds08.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
});

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });

type RequestBody = {
  email?: unknown;
  username?: unknown;
  note?: unknown;
};

const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: responseHeaders(origin) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ error: "A JSON request is required" }, 415, origin);
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > 4096) return json({ error: "Request is too large" }, 413, origin);

    let payload: RequestBody;
    try {
      payload = JSON.parse(rawBody) as RequestBody;
    } catch {
      return json({ error: "Invalid request" }, 400, origin);
    }

    const email = normalizeEmail(payload.email);
    const username = typeof payload.username === "string" ? payload.username.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : "";

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Enter a valid account email address." }, 400, origin);
    }
    if (username.length > 40 || (username && !/^[a-zA-Z0-9_./-]+$/.test(username))) {
      return json({ error: "Check the username and try again." }, 400, origin);
    }
    if (note.length > 500) return json({ error: "Additional details must be 500 characters or fewer." }, 400, origin);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Deletion request service is temporarily unavailable." }, 503, origin);
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ip = req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-real-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unavailable";
    const [ipHash, emailHash] = await Promise.all([
      hmac("account-deletion:ip:" + ip, serviceRoleKey),
      hmac("account-deletion:email:" + email, serviceRoleKey),
    ]);

    const [ipLimit, emailLimit] = await Promise.all([
      client.rpc("consume_external_deletion_rate_limit", {
        p_key_hash: ipHash,
        p_bucket: "ip",
        p_max_attempts: 5,
        p_window_seconds: 3600,
      }),
      client.rpc("consume_external_deletion_rate_limit", {
        p_key_hash: emailHash,
        p_bucket: "email",
        p_max_attempts: 3,
        p_window_seconds: 86400,
      }),
    ]);

    if (ipLimit.error || emailLimit.error) {
      console.error("External deletion request rate limiter unavailable.");
      return json({ error: "Deletion request service is temporarily unavailable." }, 503, origin);
    }
    if (ipLimit.data !== true || emailLimit.data !== true) {
      return json({ error: "Too many requests. Please wait before trying again." }, 429, origin);
    }

    const { error: submitError } = await client.rpc("submit_external_deletion_request", {
      p_email: email,
      p_username: username || null,
      p_requester_note: note || null,
    });
    if (submitError) {
      console.error("External deletion request could not be recorded.");
      return json({ error: "Deletion request service is temporarily unavailable." }, 503, origin);
    }

    return json({
      ok: true,
      message: "If the details match an account, your request has been recorded for review. We may contact you to verify account ownership or guardian authority before processing it.",
    }, 200, origin);
  } catch {
    console.error("External deletion request failed unexpectedly.");
    return json({ error: "Deletion request service is temporarily unavailable." }, 500, origin);
  }
});
