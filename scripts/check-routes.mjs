import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "App.tsx");
const manifestPath = path.join(root, "public", "manus-routes.json");
const app = fs.readFileSync(appPath, "utf8");
const failures = [];

const resolveLocalImport = (specifier) => {
  const base = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : path.resolve(path.dirname(appPath), specifier);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
    path.join(base, "index.jsx"),
    path.join(base, "index.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
};

const localImports = new Set();
const importPattern = /(?:from\s*|import\s*\()\s*["']([^"']+)["']/g;
for (const match of app.matchAll(importPattern)) {
  const specifier = match[1];
  if (specifier.startsWith("./") || specifier.startsWith("@/")) localImports.add(specifier);
}
for (const specifier of localImports) {
  if (!resolveLocalImport(specifier)) failures.push(`Missing local App dependency: ${specifier}`);
}

const routes = [...app.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicateRoutes = routes.filter((route, index) => routes.indexOf(route) !== index);
for (const route of new Set(duplicateRoutes)) failures.push(`Duplicate route registration: ${route}`);

const routeManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const manifestRoutes = routeManifest.routes.map((route) => route.path);
const duplicateManifestRoutes = manifestRoutes.filter((route, index) => manifestRoutes.indexOf(route) !== index);
for (const route of new Set(duplicateManifestRoutes)) failures.push(`Duplicate route manifest entry: ${route}`);

const registeredConcreteRoutes = routes.filter((route) => route !== "*");
for (const route of registeredConcreteRoutes) {
  if (!manifestRoutes.includes(route)) failures.push(`Registered route is missing from public/manus-routes.json: ${route}`);
}
for (const route of manifestRoutes) {
  if (!registeredConcreteRoutes.includes(route)) failures.push(`Stale route manifest entry is not registered in src/App.tsx: ${route}`);
}

const requiredRoutes = [
  "/school/manager",
  "/school/admin",
  "/school/teacher",
  "/school/parent",
  "/school/finance",
  "/school/student",
  "/super-admin",
  "/root-control-portal-9xA7",
];
for (const route of requiredRoutes) {
  if (!routes.includes(route)) failures.push(`Required portal route is not registered: ${route}`);
}

const protectedRouteRoleContracts = new Map([
  ["/guardian-controls", ["parent"]],
  ["/teacher", ["teacher"]],
  ["/admin/early-content", ["admin", "extreme_admin"]],
  ["/admin", ["admin", "extreme_admin"]],
  ["/student-dashboard", ["student"]],
  ["/school/manager", ["manager"]],
  ["/school/admin", ["teacher", "finance"]],
  ["/school/teacher", ["teacher"]],
  ["/school/parent", ["parent"]],
  ["/school/finance", ["finance"]],
  ["/school/student", ["student"]],
  ["/school/super-admin", ["super_admin"]],
  ["/manager", ["manager"]],
  ["/manager-dashboard", ["manager"]],
  ["/finance", ["finance", "extreme_admin"]],
  ["/super-admin", ["super_admin"]],
  ["/root-control-portal-9xA7", ["extreme_admin"]],
  ["/migrate-supabase", ["extreme_admin"]],
]);

for (const [route, expectedRoles] of protectedRouteRoleContracts) {
  const routeStart = app.indexOf(`path="${route}"`);
  if (routeStart < 0) {
    failures.push(`Role-protected route is not registered: ${route}`);
    continue;
  }

  const routeEnd = app.indexOf("</Route>", routeStart);
  const routeBlock = routeEnd >= 0
    ? app.slice(routeStart, routeEnd + "</Route>".length)
    : app.slice(routeStart, app.indexOf("/>", routeStart) + 2);

  if (!routeBlock.includes("<ProtectedRoute")) {
    failures.push(`Role-protected route lacks ProtectedRoute: ${route}`);
    continue;
  }

  const allowedRolesMatch = routeBlock.match(/allowedRoles=\{(\[[\s\S]*?\])\}/);
  if (!allowedRolesMatch) {
    failures.push(`Protected route has no explicit allowedRoles: ${route}`);
    continue;
  }

  const actualRoles = [...allowedRolesMatch[1].matchAll(/["']([a-z_]+)["']/g)].map((match) => match[1]).sort();
  const expectedSorted = [...expectedRoles].sort();
  if (actualRoles.length !== expectedSorted.length || actualRoles.some((role, index) => role !== expectedSorted[index])) {
    failures.push(`Role guard mismatch for ${route}: expected [${expectedSorted.join(", ")}], found [${actualRoles.join(", ")}]`);
  }
}

if (failures.length) {
  console.error("Route registry and role-guard checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Route registry and role-guard checks passed: ${registeredConcreteRoutes.length} registered routes, ${manifestRoutes.length} manifest entries, ${localImports.size} local App dependencies, and ${protectedRouteRoleContracts.size} exact role-guard contracts.`);
}
