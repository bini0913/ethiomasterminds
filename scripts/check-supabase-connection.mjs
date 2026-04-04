import fs from "node:fs";

const ENV_FILE = ".env";
const CONFIG_FILE = "supabase/config.toml";

function parseEnv(content) {
  const map = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function parseProjectIdFromToml(content) {
  const match = content.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  return match?.[1] ?? null;
}

async function checkEndpoint(name, url, options = {}) {
  try {
    const response = await fetch(url, options);
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      body: body.slice(0, 240).replace(/\s+/g, " ").trim(),
      networkError: null,
      name,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: "",
      networkError: error instanceof Error ? error.message : String(error),
      name,
    };
  }
}

async function main() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`❌ Missing ${ENV_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`❌ Missing ${CONFIG_FILE}`);
    process.exit(1);
  }

  const env = parseEnv(fs.readFileSync(ENV_FILE, "utf8"));
  const tomlProjectId = parseProjectIdFromToml(fs.readFileSync(CONFIG_FILE, "utf8"));

  const projectId = env.VITE_SUPABASE_PROJECT_ID;
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const configChecks = [
    ["VITE_SUPABASE_PROJECT_ID", Boolean(projectId)],
    ["VITE_SUPABASE_URL", Boolean(supabaseUrl)],
    ["VITE_SUPABASE_PUBLISHABLE_KEY", Boolean(publishableKey)],
    ["config.toml project_id", Boolean(tomlProjectId)],
  ];

  let hasConfigError = false;
  for (const [name, pass] of configChecks) {
    if (pass) {
      console.log(`✅ ${name} is set`);
    } else {
      console.log(`❌ ${name} is missing`);
      hasConfigError = true;
    }
  }

  if (projectId && tomlProjectId) {
    if (projectId === tomlProjectId) {
      console.log(`✅ .env and config.toml project IDs match: ${projectId}`);
    } else {
      console.log(`❌ Project ID mismatch (.env=${projectId}, config.toml=${tomlProjectId})`);
      hasConfigError = true;
    }
  }

  if (projectId && supabaseUrl) {
    const urlContainsProjectId = supabaseUrl.includes(projectId);
    if (urlContainsProjectId) {
      console.log(`✅ Supabase URL contains project ID`);
    } else {
      console.log(`❌ Supabase URL does not contain project ID`);
      hasConfigError = true;
    }
  }

  if (!supabaseUrl || !publishableKey) {
    process.exit(hasConfigError ? 1 : 0);
  }

  const headers = {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
  };

  const checks = [
    checkEndpoint("Auth settings", `${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
    }),
    checkEndpoint("REST root", `${supabaseUrl}/rest/v1/`, { headers }),
    checkEndpoint("Edge function health (assign-role)", `${supabaseUrl}/functions/v1/assign-role`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "student" }),
    }),
  ];

  const results = await Promise.all(checks);
  let anyNetworkCheckPassed = false;
  for (const result of results) {
    if (result.networkError) {
      console.log(`⚠️ ${result.name}: network error (${result.networkError})`);
      continue;
    }

    const pass = result.status !== null && result.status < 500;
    if (pass) anyNetworkCheckPassed = true;
    console.log(`${pass ? "✅" : "❌"} ${result.name}: HTTP ${result.status} ${result.body}`);
  }

  if (hasConfigError) {
    process.exit(1);
  }

  if (!anyNetworkCheckPassed) {
    console.log("⚠️ No network checks succeeded. Config looks valid, but connectivity could not be verified from this environment.");
  }
}

main();
