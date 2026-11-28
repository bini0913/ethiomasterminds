import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const portal = read("src/pages/SchoolManagerPortal.tsx");
const workspace = read("src/components/school/SchoolManagerTimetableCalendarWorkspace.tsx");
const migration = read("supabase/migrations/20261128213000_school_manager_timetable_calendar.sql");
const workflow = read(".github/workflows/portal-reliability-tests.yml");
const failures = [];
const checks = [
  ["Manager navigation exposes Timetable & Calendar", /id: "timetable", label: "Timetable & Calendar"/.test(portal)],
  ["Manager route renders the timetable/calendar workspace", /case "timetable": content = <SchoolManagerTimetableCalendarWorkspace/.test(portal)],
  ["Timetable queries are scoped to the active school", /from\("school_schedule_entries"\)[\s\S]*?\.eq\("school_id", schoolId\)/.test(workspace)],
  ["Calendar queries are scoped to the active school", /from\("school_calendar_events"\)[\s\S]*?\.eq\("school_id", schoolId\)/.test(workspace)],
  ["Timetable writes use the guarded RPC", /rpc\("school_manager_save_schedule_entry"/.test(workspace)],
  ["Calendar writes use the guarded RPC", /rpc\("school_manager_save_calendar_event"/.test(workspace)],
  ["Timetable conflicts are checked server-side", /Teacher conflict[\s\S]*?Section conflict[\s\S]*?Room conflict/.test(migration)],
  ["Teacher assignment is validated server-side", /school_teacher_assignments[\s\S]*?assignment_kind = 'subject'/.test(migration)],
  ["Calendar audiences support school, grade and section scopes", /audience_type IN \('school','grade','section'\)/.test(migration)],
  ["Calendar publication status is explicit", /status IN \('draft','published','cancelled'\)/.test(migration)],
  ["Operations audit is append-only", /school_operations_audit_events_immutable/.test(migration)],
  ["Public role cannot execute manager mutations", /REVOKE ALL ON FUNCTION public\.school_manager_save_schedule_entry[\s\S]*?FROM PUBLIC, anon/.test(migration) && /REVOKE ALL ON FUNCTION public\.school_manager_save_calendar_event[\s\S]*?FROM PUBLIC, anon/.test(migration)],
  ["Part 3.2 contract check is wired into CI", /check:school-manager-part3-timetable/.test(workflow)],
];
for (const [label, passed] of checks) if (!passed) failures.push(label);
if (failures.length) {
  console.error("School Manager Part 3.2 contracts failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exitCode = 1;
} else {
  console.log(`School Manager Part 3.2 contracts passed: ${checks.length} checks.`);
}
