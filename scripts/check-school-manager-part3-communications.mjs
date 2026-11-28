import fs from "node:fs";

const workspace = fs.readFileSync("src/components/school/SchoolManagerParentCommunicationsWorkspace.tsx", "utf8");
const portal = fs.readFileSync("src/pages/SchoolManagerPortal.tsx", "utf8");
const workflow = fs.readFileSync(".github/workflows/portal-reliability-tests.yml", "utf8");
const e2e = fs.readFileSync("tests/e2e/signed-in-portals.spec.ts", "utf8");

const checks = [
  ["Manager navigation entry", portal.includes('id: "communications", label: "Parent Communication"')],
  ["Manager route renders workspace", portal.includes('case "communications": content = <SchoolManagerParentCommunicationsWorkspace')],
  ["Announcements are school-scoped", /from\("school_announcements"\)[\s\S]*?\.eq\("school_id", schoolId\)/.test(workspace)],
  ["Parent notifications are school-scoped", /from\("school_parent_notifications"\)[\s\S]*?\.eq\("school_id", schoolId\)/.test(workspace)],
  ["Conversations are school-scoped", /from\("school_conversations"\)[\s\S]*?\.eq\("school_id", schoolId\)/.test(workspace)],
  ["Parent links are school-scoped", /from\("school_parent_student_links"\)[\s\S]*?\.eq\("school_id", schoolId\)/.test(workspace)],
  ["Message metadata is school-scoped", /from\("school_messages"\)[\s\S]*?\.eq\("school_id", schoolId\)/.test(workspace)],
  ["Private message bodies are not selected", !/from\("school_messages"\)[\s\S]*?select\([^)]*\bbody\b/.test(workspace)],
  ["Parent read state remains parent-owned", workspace.includes("cannot mark a parent's notification as read")],
  ["Announcement review permission is not bypassed", workspace.includes("publish_announcements permission") && !workspace.includes('rpc("school_review_announcement"')],
  ["No communication write actions are introduced", !/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/.test(workspace)],
  ["Notification read/unread filters exist", workspace.includes('notificationStatus === "unread"') && workspace.includes("read_at")],
  ["Announcement lifecycle filters exist", workspace.includes('announcementStatus === "all"') && workspace.includes('"pending"')],
  ["Message metadata has explicit 30-day bound", workspace.includes("daysAgo(30)")],
  ["Stale requests are ignored", workspace.includes("requestSequence.current")],
  ["Responsive signed-in E2E coverage exists", e2e.includes("School Manager parent communication oversight is reachable")],
  ["Part 3 contract is wired into CI", workflow.includes("check:school-manager-part3-communications")],
];

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
  if (!passed) failed++;
}
if (failed) {
  console.error(`${failed} School Manager Part 3 parent communication contract check(s) failed.`);
  process.exit(1);
}
console.log(`All ${checks.length} School Manager Part 3 parent communication contract checks passed.`);
