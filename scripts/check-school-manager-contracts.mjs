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
  ['student placement updates only a school-scoped student membership', /saveStudentPlacement[\\s\\S]*?from\\("school_memberships"\\)[\\s\\S]*?update\\(\\{ section_id: section\.id, grade_label: section\.grade_label \\}\\)[\\s\\S]*?eq\\("school_id", schoolId\\)[\\s\\S]*?eq\\("school_role", "student"\\)/],
  ['student placement is restricted to active or suspended memberships', /!\\["active", "suspended"\\]\\.includes\\(student\.status\\)/],
  ['student placement is exposed in the directory', /Change grade or section placement/],
  ['academic terms are loaded from school-scoped records', /from\("school_terms"\).*?eq\("school_id", schoolId\)/s],
  ['academic terms are created and updated', /const saveTerm[\s\S]*?school_terms[\s\S]*?update[\s\S]*?school_terms[\s\S]*?insert/],
  ['term dates stay inside their academic year', /termStart < academicYear\.starts_on \|\| termEnd > academicYear\.ends_on/],
  ['term numbers are unique within the selected year', /duplicateNumber = terms\.some/],
  ['term date ranges cannot overlap', /const overlaps = terms\.some/],
  ['academic year edits preserve existing term date bounds', /terms\.some\(\(term\) => term\.academic_year_id === yearEdit\.id/],
  ['subject archive/reactivation preserves catalog records', /toggleSubjectActive[\s\S]*?update\(\{ active: !subject\.active/],
  ['teacher assignments are reachable from manager navigation', /id: "assignments", label: "Teacher Assignments"/],
  ['staff directory supports search and role/status filters', /renderStaffDirectory[\s\S]*?staffRoleFilter[\s\S]*?staffStatusFilter/],
  ['manager settings preserve network-controlled school identity', /renderManagerSettings[\s\S]*?read-only in the School Manager portal/],
  ['manager settings update existing school policy rows', /school_policy_settings[\s\S]*?update\(\{/],
  ['school audit is read-only and school-scoped', /loadManagerAudit[\s\S]*?school_record_events[\s\S]*?eq\("school_id", schoolId\)[\s\S]*?school_leadership_structure_events/],
  ['school audit is reachable from manager navigation', /id: "audit", label: "School Audit"/],
  ['manager settings are reachable from manager navigation', /id: "settings", label: "Manager Settings"/],
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
