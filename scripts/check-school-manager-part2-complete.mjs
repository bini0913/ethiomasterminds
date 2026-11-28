import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const manager = read("src/pages/SchoolManagerPortal.tsx");
const teacher = read("src/pages/SchoolTeacherPortal.tsx");
const workspace = read("src/components/school/SchoolCurriculumWorkspace.tsx");
const migration = read("supabase/migrations/20261128200000_school_manager_curriculum_and_interventions.sql");
const e2e = read("tests/e2e/signed-in-portals.spec.ts");
const failures = [];
const checks = [
  ["Manager has a dedicated Curriculum & Support navigation entry", /id: "curriculum", label: "Curriculum & Support"/.test(manager)],
  ["Manager renders curriculum and intervention workspace", /SchoolCurriculumWorkspace mode="manager"/.test(manager)],
  ["Teacher has a dedicated Curriculum Delivery navigation entry", /id: "curriculum", label: "Curriculum Delivery"/.test(teacher)],
  ["Teacher renders assigned curriculum delivery workspace", /SchoolCurriculumWorkspace mode="teacher"/.test(teacher)],
  ["Curriculum units are school and academic-year scoped", /school_id uuid NOT NULL[\s\S]*?academic_year_id uuid NOT NULL[\s\S]*?school_curriculum_unit_year_school_fk/.test(migration)],
  ["Curriculum units enforce unique school/year/grade/subject/code", /UNIQUE \(school_id, academic_year_id, grade_label, subject_name, unit_code\)/.test(migration)],
  ["Curriculum progress is unique per unit and class", /CONSTRAINT school_curriculum_progress_unique UNIQUE \(unit_id, section_id\)/.test(migration)],
  ["Teacher progress RPC validates assigned subject", /school_can_teach_subject\(v_unit.school_id,p_section_id,v_unit.subject_name\)/.test(migration)],
  ["Teacher progress requires a note for taught or support-needed status", /p_status IN \('taught','needs_support'\)[\s\S]*?length\(trim\(COALESCE\(p_teacher_note,''\)\)\) < 5/.test(migration)],
  ["Progress changes are audited", /school_record_curriculum_progress_event[\s\S]*?school_curriculum_progress_audit/.test(migration)],
  ["Curriculum changes are audited", /school_record_curriculum_unit_event[\s\S]*?school_curriculum_unit_audit/.test(migration)],
  ["Academic audit event rows are immutable", /school_prevent_academic_event_mutation[\s\S]*?Academic audit events are append-only/.test(migration)],
  ["Interventions are scoped to the student, section, school and year", /school_academic_intervention_student_school_fk[\s\S]*?school_academic_intervention_section_school_fk[\s\S]*?school_academic_intervention_year_school_fk/.test(migration)],
  ["Intervention resolution requires an outcome", /p_status IN \('resolved','closed'\)[\s\S]*?length\(trim\(COALESCE\(p_outcome,''\)\)\) < 5/.test(migration)],
  ["Intervention writes require School Manager or Admin authority", /school_manager_save_academic_intervention[\s\S]*?is_school_manager_or_admin\(p_school_id\)/.test(migration)],
  ["Curriculum mutations use guarded RPCs rather than direct table writes", /school_manager_save_curriculum_unit/.test(workspace) && /school_teacher_update_curriculum_progress/.test(workspace) && !/from\("school_curriculum_units"\)[\s\S]*?\.insert\(/.test(workspace)],
  ["Intervention records are restricted to Manager/Admin read access", /school_academic_interventions_select[\s\S]*?is_school_manager_or_admin\(school_id\)/.test(migration)],
  ["Manager and teacher curriculum pages have responsive E2E coverage", /School Manager curriculum and intervention workflows/.test(e2e) && /School Teacher curriculum delivery workspace/.test(e2e)],
];
for (const [label, passed] of checks) if (!passed) failures.push(label);
if (failures.length) {
  console.error("School Manager Part 2 completion contracts failed:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exitCode = 1;
} else {
  console.log(`School Manager Part 2 completion contracts passed: ${checks.length} checks.`);
}
