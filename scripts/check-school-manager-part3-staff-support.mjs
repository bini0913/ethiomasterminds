import fs from "node:fs";

const workspace = fs.readFileSync("src/components/school/SchoolManagerStaffSupportWorkspace.tsx", "utf8");
const portal = fs.readFileSync("src/pages/SchoolManagerPortal.tsx", "utf8");
const workflow = fs.readFileSync(".github/workflows/portal-reliability-tests.yml", "utf8");
const e2e = fs.readFileSync("tests/e2e/signed-in-portals.spec.ts", "utf8");

const tables = [
  "school_staff_tasks",
  "school_staff_task_comments",
  "school_staff_evaluations",
  "school_staff_change_requests",
  "school_staff_conduct_reports",
  "school_behavior_reports",
  "school_disciplinary_recommendations",
];

const checks = [
  ["Manager navigation entry", portal.includes('id: "staff-support", label: "Staff & Student Support"')],
  ["Manager route renders the workspace", portal.includes('case "staff-support": content = <SchoolManagerStaffSupportWorkspace')],
  ["Workspace is connected to the active school membership", portal.includes("activeMembershipId={activeMembership?.id}")],
  ...tables.map((table) => ["Reads " + table + " with school scope", new RegExp('from\\("' + table + '"\\)[\\s\\S]*?\\.eq\\("school_id", schoolId\\)').test(workspace)]),
  ["Task creation uses the current manager membership", workspace.includes("assigned_by_membership_id: activeMembershipId")],
  ["Task assignee is selected from active staff only", workspace.includes('member.status === "active"') && workspace.includes('["admin", "teacher", "finance"]')],
  ["Task status updates use the school-scoped row filter", workspace.includes('.update({ status }).eq("id", task.id).eq("school_id", schoolId)')],
  ["Task comments are written to the existing comments table", workspace.includes('from("school_staff_task_comments").insert')],
  ["Task completion verification is surfaced", workspace.includes('updateTaskStatus(task, "verified")')],
  ["Task return requires feedback", workspace.includes('status === "returned" && !commentDrafts[task.id]?.trim()')],
  ["Staff evaluations are saved to the existing evaluation table", workspace.includes('from("school_staff_evaluations").insert')],
  ["Staff conduct review uses the guarded RPC", workspace.includes('rpc("school_review_staff_conduct_report"')],
  ["Student discipline review uses the guarded RPC", workspace.includes('rpc("school_review_disciplinary_recommendation"')],
  ["Only student recommendations are shown to the Manager", workspace.includes('.eq("target_kind", "student")')],
  ["Behavior report review authority is explicitly preserved", workspace.includes("does not override the report's assigned review authority") && !workspace.includes('rpc("school_review_behavior_report"')],
  ["Staff change requests are monitoring-only", workspace.includes("cannot approve a network-level role or account change") && !workspace.includes('from("school_staff_change_requests").update')],
  ["Staff disciplinary authority remains with Super Admin", workspace.includes("Staff disciplinary recommendations remain with Super Admin")],
  ["Responsive signed-in E2E coverage exists", e2e.includes("School Manager staff and student support workflows are reachable across desktop, tablet and mobile")],
  ["Part 3.4 contract is wired into CI", workflow.includes("check:school-manager-part3-staff-support")],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
  if (!passed) failed++;
}
if (failed) {
  console.error(`${failed} School Manager Part 3.4 contract check(s) failed.`);
  process.exit(1);
}
console.log(`All ${checks.length} School Manager Part 3.4 contract checks passed.`);
