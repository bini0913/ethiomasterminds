import fs from "node:fs";
import path from "node:path";

const portalPath = path.join(process.cwd(), "src", "pages", "SchoolManagerPortal.tsx");
const portal = fs.readFileSync(portalPath, "utf8");
const checks = [
  ["term form and save handler", /const saveTerm = async/],
  ["year edit and save handler", /const saveAcademicYear = async/],
  ["staff directory renderer", /const renderStaffDirectory =/],
  ["manager settings renderer", /const renderManagerSettings =/],
  ["audit renderer", /const renderSchoolAudit =/],
  ["teacher assignments renderer is reachable", /case "assignments": content = renderAssignments\(\); break/],
  ["staff directory route is reachable", /case "staff": content = renderStaffDirectory\(\); break/],
  ["audit route is reachable", /case "audit": content = renderSchoolAudit\(\); break/],
  ["settings route is reachable", /case "settings": content = renderManagerSettings\(\); break/],
];
const failures = checks.filter(([, pattern]) => !pattern.test(portal)).map(([label]) => label);
if (failures.length) {
  console.error("School Manager Part 1 checks failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exitCode = 1;
} else {
  console.log(`School Manager Part 1 checks passed: ${checks.length} workflow entry points.`);
}
