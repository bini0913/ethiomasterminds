import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type RequestBody = {
  action?: "availability" | "login";
  username?: string;
  password?: string;
};

const normalizeUsername = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

async function hashIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceRoleKey || !anonKey) return json({ error: "Authentication service unavailable" }, 503);

    const payload = await req.json() as RequestBody;
    const username = normalizeUsername(payload.username);
    const isLegacyUsername = /^[a-z0-9_]{3,20}$/.test(username);
    const isSchoolStudentUsername = /^[a-z0-9]{2,8}\\/[0-9]{1,12}\\/[0-9]{1,3}$/.test(username);
    if (!isLegacyUsername && !isSchoolStudentUsername) return json({ error: "Invalid username" }, 400);
    if (payload.action !== "availability" && payload.action !== "login") {
      return json({ error: "Invalid action" }, 400);
    }
    if (payload.action === "login" && (typeof payload.password !== "string"
      || payload.password.length < 1 || payload.password.length > 128)) {
      return json({ error: "Invalid username or password" }, 400);
    }

    const ip = req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-real-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (!ip) return json({ error: "Unable to verify request origin" }, 400);

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const bucket = payload.action;
    const rateKey = bucket === "login"
      ? ip + "\nlogin\n" + username
      : ip + "\navailability";
    const { data: allowed, error: rateError } = await admin.rpc("consume_username_auth_rate_limit", {
      p_key_hash: await hashIp(rateKey, serviceRoleKey),
      p_bucket: bucket,
    });
    if (rateError) {
      console.error("Username auth rate limiter failed:", rateError);
      return json({ error: "Authentication service unavailable" }, 503);
    }
    if (allowed !== true) return json({ error: "Too many attempts. Please wait and try again." }, 429);

    if (payload.action === "availability") {
      const { data: profile, error } = await admin.from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (error) {
        console.error("Username availability query failed:", error);
        return json({ error: "Unable to check username" }, 503);
      }
      return json({ available: !profile });
    }

    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (profileError) {
      console.error("Username login lookup failed:", profileError);
      return json({ error: "Authentication service unavailable" }, 503);
    }

    let email = "unknown-user-" + username + "@username.invalid";
    if (profile?.id) {
      const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(profile.id);
      if (!authUserError && authUser.user?.email) email = authUser.user.email;
    }

    // Always call GoTrue, even for an unknown username, to keep failures generic
    // and apply Supabase Auth's password-grant rate limits consistently.
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authResult, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password: payload.password,
    });

    if (authError || !authResult.session) {
      return json({ error: "Invalid username or password" }, 401);
    }

    // Return only the session credentials required by supabase.auth.setSession.
    // Never return the resolved account email to the browser.
    return json({
      access_token: authResult.session.access_token,
      refresh_token: authResult.session.refresh_token,
    });
  } catch (error) {
    console.error("Username auth request failed:", error);
    return json({ error: "Authentication service unavailable" }, 500);
  }
});
