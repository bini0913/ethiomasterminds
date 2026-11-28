import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const portalPath = path.join(root, "src", "pages", "SchoolManagerPortal.tsx");
const portal = fs.readFileSync(portalPath, "utf8");
const failures = [];

const requiredContracts = [
  ['Student Directory navigation entry', /id: "students", label: "Student Directory"/],
  ['student records are scoped to school memberships', /members\.filter\(\(member\) => member\.school_role === "student"\)/],
  ['student directory supports search', /studentSearch\.trim\(\)\.toLowerCase\(\)/],
  ['student directory supports enrollment status filtering', /studentStatusFilter === "all" \|\| student\.status === studentStatusFilter/],
  ['transfer, graduation, and deactivation are explicit exit states', /"transferred" \| "graduated" \| "deactivated"/],
  ['student exits use the guarded school RPC', /db\.rpc\("school_deactivate_student_membership"/],
  ['student exit requires a reason', /reason\.length < 5/],
  ['student exit reason is sent to the database', /p_reason: reason/],
  ['student exit refreshes the authoritative records', /await load\(\);/],
  ['student exit actions preserve membership instead of deleting accounts', /does not delete the student's account/],
];

for (const [label, pattern] of requiredContracts) {
  if (!pattern.test(portal)) failures.push(label);
}

if (failures.length) {
  console.error("School Manager workflow contract checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`School Manager workflow contract checks passed: ${requiredContracts.length} contracts.`);
}
