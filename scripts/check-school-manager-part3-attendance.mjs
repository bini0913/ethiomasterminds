import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const portal = read("src/pages/SchoolManagerPortal.tsx");
const workspace = read("src/components/school/SchoolManagerAttendanceWorkspace.tsx");
const failures = [];
const checks = [
  ["Manager navigation exposes Attendance & Daily Operations", /id: "attendance", label: "Attendance & Daily Operations"/.test(portal)],
  ["Manager route renders the attendance workspace", /case "attendance": content = <SchoolManagerAttendanceWorkspace/.test(portal)],
  ["Attendance sessions are scoped to the active school", /from\("school_attendance_sessions"\)[\s\S]*?\.eq\("school_id", schoolId\)/.test(workspace)],
  ["Attendance records are scoped to the active school", /from\("school_attendance_records"\)[\s\S]*?\.eq\("school_id", schoolId\)/.test(workspace)],
  ["Workspace reports all four supported attendance statuses", /"present"[\s\S]*?"absent"[\s\S]*?"late"[\s\S]*?"excused"/.test(workspace)],
  ["Workspace distinguishes unmarked students from recorded absences", /Students not yet marked/.test(workspace) && /Recorded absences/.test(workspace)],
  ["Workspace explicitly does not bypass leadership correction permissions", /Corrections require an active leadership appointment/.test(workspace)],
  ["Workspace has stale-request protection", /requestSequence/.test(workspace)],
  ["Attendance workspace is responsive and includes desktop/mobile layout classes", /sm:grid-cols-2 xl:grid-cols-4/.test(workspace) && /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1.1fr\)\]/.test(workspace)],
];
for (const [label, passed] of checks) if (!passed) failures.push(label);
if (failures.length) {
  console.error("School Manager Part 3 attendance contracts failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exitCode = 1;
} else {
  console.log(`School Manager Part 3 attendance contracts passed: ${checks.length} checks.`);
}
