import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "App.tsx");
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

if (failures.length) {
  console.error("Route registry check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Route registry check passed: ${routes.length} routes, ${localImports.size} local App dependencies, and all required portal routes.`);
}
