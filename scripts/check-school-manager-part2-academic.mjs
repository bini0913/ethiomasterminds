import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manager = fs.readFileSync(path.join(root, "src/pages/SchoolManagerPortal.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(root, "src/components/school/SchoolManagerAcademicWorkspace.tsx"), "utf8");
const failures = [];
const checks = [
  ["Academic Management is in the Manager navigation", /id: "academics", label: "Academic Management"/.test(manager)],
  ["Academic Management route renders the dedicated workspace", /case "academics": content = <SchoolManagerAcademicWorkspace/.test(manager)],
  ["Assessment records are school scoped", /from\("school_assessments"\)[\s\S]*?eq\("school_id", schoolId\)/.test(workspace)],
  ["Marks are school scoped", /from\("school_student_marks"\)[\s\S]*?eq\("school_id", schoolId\)/.test(workspace)],
  ["Term results are school scoped", /from\("school_term_results"\)[\s\S]*?eq\("school_id", schoolId\)/.test(workspace)],
  ["Homework and submissions are school scoped", /from\("school_homework_assignments"\)[\s\S]*?eq\("school_id", schoolId\)[\s\S]*?from\("school_homework_submissions"\)[\s\S]*?eq\("school_id", schoolId\)/.test(workspace)],
  ["Quizzes and library books are school scoped", /from\("quizzes"\)[\s\S]*?eq\("school_id", schoolId\)[\s\S]*?from\("library_books"\)[\s\S]*?eq\("school_id", schoolId\)/.test(workspace)],
  ["Shared textbook catalog is explicitly separate from school uploads", /Ethiopian textbook reference catalog[\s\S]*?not the same as a school's uploaded or assigned textbooks/.test(workspace)],
  ["Subject assignment coverage is not presented as lesson completion", /not a lesson-by-lesson curriculum completion claim/.test(workspace)],
  ["Below-pass follow-up uses configured grade pass marks", /result\.average_score[\s\S]*?policy\.pass_mark/.test(workspace)],
  ["Assessment approval is not bypassed by the Manager workspace", /appointed academic leader with the required review permission/.test(workspace)],
  ["The academic workspace does not write to academic records", !/\.insert\(|\.update\(|\.delete\(|\.rpc\(/.test(workspace)],
  ["Academic workspace is reachable in the signed-in portal E2E suite", /School Manager academic oversight is reachable on desktop, tablet and mobile/.test(fs.readFileSync(path.join(root, "tests/e2e/signed-in-portals.spec.ts"), "utf8"))],
];
for (const [label, passed] of checks) if (!passed) failures.push(label);
const schoolScopedReads = (workspace.match(/eq\("school_id", schoolId\)/g) || []).length;
if (schoolScopedReads !== 7) failures.push(`Expected 7 school-scoped academic data reads, found ${schoolScopedReads}`);

if (failures.length) {
  console.error("School Manager Part 2 academic contracts failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exitCode = 1;
} else {
  console.log(`School Manager Part 2 academic contracts passed: ${checks.length + 1} checks.`);
}
