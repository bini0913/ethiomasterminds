import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SchoolEmptyState, SchoolField, SchoolMetric, SchoolPageHeading, SchoolPanel, SchoolStatus,
  SchoolPrimaryButton, SchoolSecondaryButton, schoolInputClass, schoolSelectClass, schoolTextareaClass,
} from "@/components/school/SchoolPortalPrimitives";

type Props = {
  mode: "manager" | "teacher";
  schoolId?: string;
  years: any[];
  sections: any[];
  subjects: any[];
  assignments: any[];
  members: any[];
  profiles?: Record<string, any>;
};

const gradeNumber = (label: string) => { const match = label.match(/[0-9]+/); return match ? Number(match[0]) : null; };

const initialUnit = {
  academicYearId: "", gradeLabel: "", subjectName: "", unitCode: "", title: "",
  description: "", sequence: "1", sourceType: "school_defined", sourceTitle: "",
  sourceUrl: "", sourceCatalogId: "", sourceLibraryBookId: "", sourceVerification: "unverified", expectedStart: "", expectedEnd: "", isActive: true,
};

export default function SchoolCurriculumWorkspace({
  mode, schoolId, years, sections, subjects, assignments, members, profiles = {},
}: Props) {
  const db = supabase as any;
  const manager = mode === "manager";
  const [units, setUnits] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [unitEvents, setUnitEvents] = useState<any[]>([]);
  const [interventionEvents, setInterventionEvents] = useState<any[]>([]);
  const [textbookCatalog, setTextbookCatalog] = useState<any[]>([]);
  const [approvedBooks, setApprovedBooks] = useState<any[]>([]);
  const requestSequence = useRef(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [unitForm, setUnitForm] = useState(initialUnit);
  const [editingUnitId, setEditingUnitId] = useState("");
  const [unitYearFilter, setUnitYearFilter] = useState("");
  const [unitGradeFilter, setUnitGradeFilter] = useState("all");
  const [teacherSectionId, setTeacherSectionId] = useState("");
  const [teacherUnitId, setTeacherUnitId] = useState("");
  const [teacherStatus, setTeacherStatus] = useState("in_progress");
  const [teacherNote, setTeacherNote] = useState("");
  const [interventionId, setInterventionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [interventionSectionId, setInterventionSectionId] = useState("");
  const [interventionSubject, setInterventionSubject] = useState("");
  const [interventionCategory, setInterventionCategory] = useState("academic_performance");
  const [concern, setConcern] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [interventionStatus, setInterventionStatus] = useState("open");
  const [outcome, setOutcome] = useState("");

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!schoolId) {
      setUnits([]); setProgress([]); setInterventions([]); setUnitEvents([]); setInterventionEvents([]); setTextbookCatalog([]); setApprovedBooks([]);
      setLoadError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const requests = await Promise.all([
        db.from("school_curriculum_units").select("*").eq("school_id", schoolId).order("sequence_number").limit(1500),
        db.from("school_curriculum_progress").select("*").eq("school_id", schoolId).order("updated_at", { ascending: false }).limit(3000),
        ...(manager ? [
          db.from("school_academic_interventions").select("*").eq("school_id", schoolId).order("updated_at", { ascending: false }).limit(1000),
          db.from("school_curriculum_unit_events").select("id,unit_id,actor_user_id,event_type,unit_snapshot,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
          db.from("school_academic_intervention_events").select("id,intervention_id,actor_membership_id,previous_status,new_status,reason,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
          db.from("curriculum_textbook_catalog").select("id,grade_level,subject,book_title,source_name,source_url,official_portal_url,source_status").order("grade_level").order("subject").limit(1000),
          db.from("library_books").select("id,title,author,subject,school_grade_label,grade_level,status,school_review_status").eq("school_id", schoolId).eq("status", "approved").eq("school_review_status", "approved").limit(1000),
        ] : []),
      ]);
      const labels = manager ? ["Curriculum units", "Teaching progress", "Academic interventions", "Curriculum audit events", "Intervention audit events", "National textbook catalog", "Approved school library books"] : ["Curriculum units", "Teaching progress"];
      if (requestId !== requestSequence.current) return;
      const errors = requests.flatMap((result: any, index: number) => result.error ? [labels[index] + ": " + result.error.message] : []);
      if (errors.length) setLoadError(errors.join(" · "));
      setUnits(requests[0].data || []);
      setProgress(requests[1].data || []);
      setInterventions(manager ? requests[2]?.data || [] : []);
      setUnitEvents(manager ? requests[3]?.data || [] : []);
      setInterventionEvents(manager ? requests[4]?.data || [] : []);
      setTextbookCatalog(manager ? requests[5]?.data || [] : []);
      setApprovedBooks(manager ? requests[6]?.data || [] : []);
    } catch (error: unknown) {
      if (requestId === requestSequence.current) {
        setLoadError(error instanceof Error ? error.message : "Academic workflows could not be loaded.");
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [db, schoolId, manager]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!unitForm.academicYearId && years.length) {
      const current = years.find((year) => year.is_current) || years[0];
      setUnitForm((form) => ({ ...form, academicYearId: current.id }));
      setUnitYearFilter(current.id);
    }
  }, [years, unitForm.academicYearId]);

  const availableGrades = useMemo(() => [...new Set(subjects
    .filter((subject) => !unitForm.academicYearId || subject.academic_year_id === unitForm.academicYearId)
    .map((subject) => subject.grade_label))].sort(), [subjects, unitForm.academicYearId]);
  const formSubjects = useMemo(() => subjects.filter((subject) =>
    subject.active && subject.academic_year_id === unitForm.academicYearId &&
    (!unitForm.gradeLabel || subject.grade_label === unitForm.gradeLabel)
  ), [subjects, unitForm.academicYearId, unitForm.gradeLabel]);
  const scopedUnits = useMemo(() => units.filter((unit) =>
    (!unitYearFilter || unit.academic_year_id === unitYearFilter) &&
    (unitGradeFilter === "all" || unit.grade_label === unitGradeFilter)
  ), [units, unitYearFilter, unitGradeFilter]);

  const teacherAssignments = useMemo(() => assignments.filter((item) => item.assignment_kind === "subject"), [assignments]);
  const teacherSections = useMemo(() => sections.filter((section) =>
    teacherAssignments.some((assignment) => assignment.section_id === section.id)
  ), [sections, teacherAssignments]);
  const teacherSubjects = useMemo(() => teacherAssignments.filter((assignment) =>
    !teacherSectionId || assignment.section_id === teacherSectionId
  ), [teacherAssignments, teacherSectionId]);
  const teacherUnits = useMemo(() => units.filter((unit) =>
    teacherSubjects.some((assignment) => {
      const section = sections.find((item) => item.id === assignment.section_id);
      return section && unit.academic_year_id === section.academic_year_id &&
        unit.grade_label === section.grade_label &&
        unit.subject_name.toLowerCase() === assignment.subject_name.toLowerCase();
    })
  ), [units, teacherSubjects, sections]);
  const activeStudents = useMemo(() => members.filter((member) =>
    member.school_role === "student" && ["active", "suspended"].includes(member.status)
  ), [members]);

  const memberName = (membershipId: string) => {
    const member = members.find((item) => item.id === membershipId);
    if (!member) return "Student";
    const profile = profiles[member.user_id] || {};
    return profile.full_name || profile.display_name || profile.username || member.school_username || "School member";
  };
  const sectionName = (sectionId: string) => {
    const section = sections.find((item) => item.id === sectionId);
    return section ? section.grade_label + " · " + section.section_name : "Section";
  };

  const saveUnit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !unitForm.academicYearId || !unitForm.gradeLabel || !unitForm.subjectName) {
      toast.error("Choose an academic year, grade, and active subject.");
      return;
    }
    setSaving(true);
    const { error } = await db.rpc("school_manager_save_curriculum_unit", {
      p_school_id: schoolId,
      p_academic_year_id: unitForm.academicYearId,
      p_grade_label: unitForm.gradeLabel,
      p_subject_name: unitForm.subjectName,
      p_unit_code: unitForm.unitCode,
      p_title: unitForm.title,
      p_description: unitForm.description,
      p_sequence_number: Number(unitForm.sequence),
      p_source_type: unitForm.sourceType,
      p_source_title: unitForm.sourceTitle,
      p_source_url: unitForm.sourceUrl || null,
      p_source_catalog_id: unitForm.sourceCatalogId || null,
      p_source_library_book_id: unitForm.sourceLibraryBookId || null,
      p_source_verification: unitForm.sourceVerification,
      p_expected_start: unitForm.expectedStart || null,
      p_expected_end: unitForm.expectedEnd || null,
      p_is_active: unitForm.isActive,
      p_unit_id: editingUnitId || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingUnitId ? "Curriculum unit updated." : "Curriculum unit created.");
    setUnitForm({ ...initialUnit, academicYearId: unitForm.academicYearId, gradeLabel: unitForm.gradeLabel, subjectName: unitForm.subjectName });
    setEditingUnitId("");
    await load();
  };

  const editUnit = (unit: any) => {
    setEditingUnitId(unit.id);
    setUnitForm({
      academicYearId: unit.academic_year_id, gradeLabel: unit.grade_label, subjectName: unit.subject_name,
      unitCode: unit.unit_code, title: unit.title, description: unit.description || "",
      sequence: String(unit.sequence_number), sourceType: unit.source_type, sourceTitle: unit.source_title || "",
      sourceUrl: unit.source_url || "", sourceCatalogId: unit.source_catalog_id || "", sourceLibraryBookId: unit.source_library_book_id || "", sourceVerification: unit.source_verification,
      expectedStart: unit.expected_start || "", expectedEnd: unit.expected_end || "", isActive: unit.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveProgress = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teacherUnitId || !teacherSectionId) { toast.error("Choose your assigned class and curriculum unit."); return; }
    setSaving(true);
    const { error } = await db.rpc("school_teacher_update_curriculum_progress", {
      p_unit_id: teacherUnitId, p_section_id: teacherSectionId,
      p_status: teacherStatus, p_teacher_note: teacherNote,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Teaching progress recorded.");
    setTeacherNote("");
    await load();
  };

  const editIntervention = (item: any) => {
    setInterventionId(item.id); setStudentId(item.student_membership_id);
    setInterventionSectionId(item.section_id); setInterventionSubject(item.subject_name);
    setInterventionCategory(item.category); setConcern(item.concern); setActionPlan(item.action_plan);
    setTargetDate(item.target_date || ""); setInterventionStatus(item.status); setOutcome(item.outcome || "");
  };
  const resetIntervention = () => {
    setInterventionId(""); setStudentId(""); setInterventionSectionId(""); setInterventionSubject("");
    setInterventionCategory("academic_performance"); setConcern(""); setActionPlan("");
    setTargetDate(""); setInterventionStatus("open"); setOutcome("");
  };
  const saveIntervention = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !studentId || !interventionSectionId || !unitForm.academicYearId) {
      toast.error("Choose a student, section, and academic year.");
      return;
    }
    setSaving(true);
    const { error } = await db.rpc("school_manager_save_academic_intervention", {
      p_school_id: schoolId, p_student_membership_id: studentId,
      p_section_id: interventionSectionId, p_academic_year_id: unitForm.academicYearId,
      p_subject_name: interventionSubject, p_category: interventionCategory,
      p_concern: concern, p_action_plan: actionPlan, p_target_date: targetDate || null,
      p_status: interventionStatus, p_outcome: outcome, p_intervention_id: interventionId || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(interventionId ? "Academic support plan updated." : "Academic support plan created.");
    resetIntervention();
    await load();
  };

  if (manager) {
    const progressByUnit = (unitId: string) => progress.filter((item) => item.unit_id === unitId);
    const taughtCount = progress.filter((item) => item.status === "taught").length;
    const supportCount = progress.filter((item) => item.status === "needs_support").length;
    const openInterventions = interventions.filter((item) => ["open", "in_progress"].includes(item.status)).length;
    return (
      <div className="space-y-5">
        <SchoolPageHeading title="Curriculum and academic support" description="Manage school curriculum units, monitor teacher-reported delivery, and coordinate documented student support plans." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SchoolMetric label="Curriculum units" value={units.filter((unit) => unit.is_active).length} detail="Active school-defined units" icon={BookOpen} />
          <SchoolMetric label="Units reported taught" value={taughtCount} detail="Teacher-reported, not mastery" icon={CheckCircle2} />
          <SchoolMetric label="Classes needing support" value={supportCount} detail="Teacher-submitted support flags" icon={AlertTriangle} />
          <SchoolMetric label="Open student plans" value={openInterventions} detail="Open or in progress" icon={ClipboardList} />
        </div>
        <SchoolPanel title={editingUnitId ? "Edit curriculum unit" : "Add curriculum unit"} description="Enter units from your school's approved curriculum or teaching plan. A source label and URL can be recorded; external verification is not automatic.">
          <form onSubmit={saveUnit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SchoolField label="Academic year"><select className={schoolSelectClass} value={unitForm.academicYearId} onChange={(event) => setUnitForm({ ...unitForm, academicYearId: event.target.value, gradeLabel: "", subjectName: "" })}><option value="">Choose year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
            <SchoolField label="Grade"><select className={schoolSelectClass} value={unitForm.gradeLabel} onChange={(event) => setUnitForm({ ...unitForm, gradeLabel: event.target.value, subjectName: "" })}><option value="">Choose grade</option>{availableGrades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></SchoolField>
            <SchoolField label="Subject"><select className={schoolSelectClass} value={unitForm.subjectName} onChange={(event) => setUnitForm({ ...unitForm, subjectName: event.target.value })}><option value="">Choose subject</option>{formSubjects.map((subject) => <option key={subject.id} value={subject.subject_name}>{subject.subject_name}</option>)}</select></SchoolField>
            <SchoolField label="Unit code"><input required className={schoolInputClass} value={unitForm.unitCode} onChange={(event) => setUnitForm({ ...unitForm, unitCode: event.target.value })} placeholder="Unit 1" maxLength={40} /></SchoolField>
            <SchoolField label="Unit title"><input required className={schoolInputClass} value={unitForm.title} onChange={(event) => setUnitForm({ ...unitForm, title: event.target.value })} maxLength={180} /></SchoolField>
            <SchoolField label="Sequence"><input required type="number" min="1" className={schoolInputClass} value={unitForm.sequence} onChange={(event) => setUnitForm({ ...unitForm, sequence: event.target.value })} /></SchoolField>
            <SchoolField label="Source type"><select className={schoolSelectClass} value={unitForm.sourceType} onChange={(event) => setUnitForm({ ...unitForm, sourceType: event.target.value })}><option value="school_defined">School-defined</option><option value="official_curriculum">Official curriculum</option><option value="textbook">Textbook</option><option value="teacher_planned">Teacher planned</option><option value="other">Other</option></select></SchoolField>
            <SchoolField label="National textbook catalog"><select className={schoolSelectClass} value={unitForm.sourceCatalogId} onChange={(event) => { const selected = textbookCatalog.find((item) => item.id === event.target.value); setUnitForm({ ...unitForm, sourceCatalogId: event.target.value, sourceLibraryBookId: "", sourceType: "textbook", sourceTitle: selected?.book_title || unitForm.sourceTitle, sourceUrl: selected?.official_portal_url || selected?.source_url || "" }); }}><option value="">No catalog link</option>{textbookCatalog.filter((item) => item.subject.toLowerCase() === unitForm.subjectName.toLowerCase() && (gradeNumber(unitForm.gradeLabel) === null || item.grade_level === gradeNumber(unitForm.gradeLabel))).map((item) => <option key={item.id} value={item.id}>Grade {item.grade_level} · {item.subject} · {item.book_title}</option>)}</select></SchoolField>
            <SchoolField label="Approved school library book"><select className={schoolSelectClass} value={unitForm.sourceLibraryBookId} onChange={(event) => { const selected = approvedBooks.find((item) => item.id === event.target.value); setUnitForm({ ...unitForm, sourceLibraryBookId: event.target.value, sourceCatalogId: "", sourceType: "textbook", sourceTitle: selected?.title || unitForm.sourceTitle, sourceUrl: "" }); }}><option value="">No school book link</option>{approvedBooks.filter((item) => item.subject.toLowerCase() === unitForm.subjectName.toLowerCase() && (item.school_grade_label === unitForm.gradeLabel || (gradeNumber(unitForm.gradeLabel) !== null && item.grade_level === gradeNumber(unitForm.gradeLabel)))).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.author}</option>)}</select></SchoolField>
            <SchoolField label="Source title"><input className={schoolInputClass} value={unitForm.sourceTitle} onChange={(event) => setUnitForm({ ...unitForm, sourceTitle: event.target.value })} maxLength={240} /></SchoolField>
            <SchoolField label="Source URL"><input type="url" className={schoolInputClass} value={unitForm.sourceUrl} onChange={(event) => setUnitForm({ ...unitForm, sourceUrl: event.target.value })} placeholder="https://" /></SchoolField>
            <SchoolField label="Source verification"><select className={schoolSelectClass} value={unitForm.sourceVerification} onChange={(event) => setUnitForm({ ...unitForm, sourceVerification: event.target.value })}><option value="unverified">Not verified</option><option value="verified_by_school">Verified by our school</option></select></SchoolField>
            <SchoolField label="Unit status"><select className={schoolSelectClass} value={unitForm.isActive ? "active" : "archived"} onChange={(event) => setUnitForm({ ...unitForm, isActive: event.target.value === "active" })}><option value="active">Active</option><option value="archived">Archived</option></select></SchoolField>
            <SchoolField label="Expected start"><input type="date" className={schoolInputClass} value={unitForm.expectedStart} onChange={(event) => setUnitForm({ ...unitForm, expectedStart: event.target.value })} /></SchoolField>
            <SchoolField label="Expected end"><input type="date" className={schoolInputClass} value={unitForm.expectedEnd} onChange={(event) => setUnitForm({ ...unitForm, expectedEnd: event.target.value })} /></SchoolField>
            <div className="md:col-span-2 xl:col-span-3"><SchoolField label="Description"><textarea rows={2} maxLength={4000} className={schoolTextareaClass} value={unitForm.description} onChange={(event) => setUnitForm({ ...unitForm, description: event.target.value })} /></SchoolField></div>
            <div className="flex gap-2 md:col-span-2 xl:col-span-3"><SchoolPrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : editingUnitId ? "Update unit" : "Add unit"}</SchoolPrimaryButton>{editingUnitId && <SchoolSecondaryButton type="button" onClick={() => { setEditingUnitId(""); setUnitForm(initialUnit); }}>Cancel</SchoolSecondaryButton>}</div>
          </form>
        </SchoolPanel>
        <SchoolPanel title="Teaching delivery by class" description="Status is reported by the assigned teacher and does not mean students have mastered the unit.">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <SchoolField label="Academic year"><select className={schoolSelectClass} value={unitYearFilter} onChange={(event) => setUnitYearFilter(event.target.value)}><option value="">All years</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
            <SchoolField label="Grade"><select className={schoolSelectClass} value={unitGradeFilter} onChange={(event) => setUnitGradeFilter(event.target.value)}><option value="all">All grades</option>{[...new Set(units.map((unit) => unit.grade_label))].sort().map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></SchoolField>
          </div>
          {scopedUnits.length ? <div className="space-y-3">{scopedUnits.map((unit) => {
            const reports = progressByUnit(unit.id);
            return <div key={unit.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{unit.unit_code} · {unit.title}</p><p className="text-xs text-slate-500">{unit.grade_label} · {unit.subject_name} · {unit.source_title || unit.source_type} · {unit.source_verification === "verified_by_school" ? "School verified" : "Unverified source"}</p><p className="mt-1 text-xs text-slate-500">Expected {unit.expected_start || "—"} to {unit.expected_end || "—"}</p></div><SchoolSecondaryButton onClick={() => editUnit(unit)}>Edit</SchoolSecondaryButton></div>
              <div className="mt-3 flex flex-wrap gap-2">{reports.length ? reports.map((report) => <div key={report.id} className="rounded-md bg-slate-50 px-3 py-2 text-xs"><p className="font-medium text-slate-700">{sectionName(report.section_id)} · {memberName(report.teacher_membership_id)}</p><SchoolStatus value={report.status} /><p className="mt-1 text-slate-500">{report.teacher_note || "No teacher note"}</p></div>) : <p className="text-xs text-slate-500">No teacher delivery report yet.</p>}</div>
            </div>;
          })}</div> : <SchoolEmptyState title="No curriculum units entered" description="Add your verified curriculum units to begin tracking class delivery. No sample units are preloaded." />}
        </SchoolPanel>
        <SchoolPanel title="Academic intervention plans" description="Document concerns, practical support actions, target dates, and outcomes. These notes are school-restricted and are not shown in student or parent portals.">
          <form onSubmit={saveIntervention} className="grid gap-3 md:grid-cols-2">
            <SchoolField label="Student"><select required className={schoolSelectClass} value={studentId} onChange={(event) => { const id = event.target.value; setStudentId(id); const member = activeStudents.find((item) => item.id === id); setInterventionSectionId(member?.section_id || ""); }}><option value="">Choose student</option>{activeStudents.map((member) => <option key={member.id} value={member.id}>{memberName(member.id)} · {member.school_username || member.id.slice(0,8)}</option>)}</select></SchoolField>
            <SchoolField label="Section"><select required className={schoolSelectClass} value={interventionSectionId} onChange={(event) => setInterventionSectionId(event.target.value)}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{sectionName(section.id)}</option>)}</select></SchoolField>
            <SchoolField label="Academic year"><select required className={schoolSelectClass} value={unitForm.academicYearId} onChange={(event) => setUnitForm({ ...unitForm, academicYearId: event.target.value })}><option value="">Choose year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
            <SchoolField label="Subject"><select className={schoolSelectClass} value={interventionSubject} onChange={(event) => setInterventionSubject(event.target.value)}><option value="">General support</option>{subjects.filter((subject) => subject.active).map((subject) => <option key={subject.id} value={subject.subject_name}>{subject.grade_label} · {subject.subject_name}</option>)}</select></SchoolField>
            <SchoolField label="Category"><select className={schoolSelectClass} value={interventionCategory} onChange={(event) => setInterventionCategory(event.target.value)}><option value="academic_performance">Academic performance</option><option value="attendance_impact">Attendance impact</option><option value="homework_support">Homework support</option><option value="learning_support">Learning support</option><option value="other">Other</option></select></SchoolField>
            <SchoolField label="Target date"><input type="date" className={schoolInputClass} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></SchoolField>
            <div className="md:col-span-2"><SchoolField label="Concern / evidence"><textarea required minLength={5} rows={2} className={schoolTextareaClass} value={concern} onChange={(event) => setConcern(event.target.value)} /></SchoolField></div>
            <div className="md:col-span-2"><SchoolField label="Support action plan"><textarea required minLength={5} rows={2} className={schoolTextareaClass} value={actionPlan} onChange={(event) => setActionPlan(event.target.value)} /></SchoolField></div>
            <SchoolField label="Plan status"><select className={schoolSelectClass} value={interventionStatus} onChange={(event) => setInterventionStatus(event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></SchoolField>
            <SchoolField label="Outcome (required to resolve/close)"><textarea rows={2} className={schoolTextareaClass} value={outcome} onChange={(event) => setOutcome(event.target.value)} /></SchoolField>
            <div className="md:col-span-2 flex gap-2"><SchoolPrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : interventionId ? "Update plan" : "Create plan"}</SchoolPrimaryButton>{interventionId && <SchoolSecondaryButton type="button" onClick={resetIntervention}>Cancel</SchoolSecondaryButton>}</div>
          </form>
          <div className="mt-4 space-y-2">{interventions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-800">{memberName(item.student_membership_id)} · {item.subject_name || "General support"}</p><p className="text-xs text-slate-500">{item.concern}</p><p className="text-xs text-slate-500">Target {item.target_date || "—"} · {item.action_plan}</p><SchoolStatus value={item.status} /></div><SchoolSecondaryButton onClick={() => editIntervention(item)}>Update</SchoolSecondaryButton></div>)}</div>
        </SchoolPanel>
        <SchoolPanel title="Academic audit history" description="Recent curriculum and student-support changes recorded by the database. These events cannot be edited from the portal.">
          <div className="grid gap-4 xl:grid-cols-2">
            <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Curriculum changes</h4>
              {unitEvents.length ? <div className="space-y-2">{unitEvents.slice(0,20).map((event) => <div key={event.id} className="rounded-md border border-slate-100 p-3"><p className="text-sm font-medium text-slate-800">{event.unit_snapshot?.unit_code} · {event.unit_snapshot?.title}</p><p className="text-xs text-slate-500">{event.event_type.replace(/_/g," ")} · {event.unit_snapshot?.grade_label} · {event.unit_snapshot?.subject_name} · {formatDate(event.created_at)}</p></div>)}</div> : <p className="text-sm text-slate-500">No curriculum changes recorded yet.</p>}
            </div>
            <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Intervention changes</h4>
              {interventionEvents.length ? <div className="space-y-2">{interventionEvents.slice(0,20).map((event) => <div key={event.id} className="rounded-md border border-slate-100 p-3"><p className="text-sm font-medium text-slate-800">{event.previous_status ? event.previous_status.replace(/_/g," ") + " → " : ""}{event.new_status.replace(/_/g," ")}</p><p className="text-xs text-slate-500">{event.reason} · {formatDate(event.created_at)}</p></div>)}</div> : <p className="text-sm text-slate-500">No intervention changes recorded yet.</p>}
            </div>
          </div>
        </SchoolPanel>
        <div className="flex justify-end"><SchoolSecondaryButton onClick={() => void load()} disabled={loading}>Refresh academic records</SchoolSecondaryButton></div>
      </div>
    );
  }

  const selectedProgress = progress.find((item) => item.unit_id === teacherUnitId && item.section_id === teacherSectionId);
  return (
    <div className="space-y-5">
      <SchoolPageHeading title="Curriculum delivery" description="Record progress only for the subjects and classes assigned to you. Teaching delivery is not a student mastery score." />
      <SchoolPanel title="My assigned curriculum units" description="Only active curriculum units matching your assigned subject, grade, and academic year are available.">
        <form onSubmit={saveProgress} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Assigned class"><select className={schoolSelectClass} value={teacherSectionId} onChange={(event) => { setTeacherSectionId(event.target.value); setTeacherUnitId(""); }}><option value="">Choose class</option>{teacherSections.map((section) => <option key={section.id} value={section.id}>{sectionName(section.id)}</option>)}</select></SchoolField>
          <SchoolField label="Curriculum unit"><select className={schoolSelectClass} value={teacherUnitId} onChange={(event) => setTeacherUnitId(event.target.value)}><option value="">Choose unit</option>{teacherUnits.filter((unit) => { const section = sections.find((item) => item.id === teacherSectionId); return section && unit.academic_year_id === section.academic_year_id && unit.grade_label === section.grade_label && teacherAssignments.some((assignment) => assignment.section_id === teacherSectionId && assignment.subject_name.toLowerCase() === unit.subject_name.toLowerCase()); }).map((unit) => <option key={unit.id} value={unit.id}>{unit.subject_name} · {unit.unit_code} · {unit.title}</option>)}</select></SchoolField>
          <SchoolField label="Delivery status"><select className={schoolSelectClass} value={teacherStatus} onChange={(event) => setTeacherStatus(event.target.value)}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="taught">Taught</option><option value="needs_support">Needs support</option></select></SchoolField>
          <SchoolField label="Teaching note / evidence"><textarea rows={2} className={schoolTextareaClass} value={teacherNote} onChange={(event) => setTeacherNote(event.target.value)} placeholder="Required for Taught or Needs support" /></SchoolField>
          {selectedProgress && <div className="rounded-md bg-slate-50 p-3 text-sm md:col-span-2"><p className="font-medium text-slate-700">Current report</p><SchoolStatus value={selectedProgress.status} /><p className="mt-1 text-xs text-slate-500">{selectedProgress.teacher_note || "No note"}</p></div>}
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit" disabled={saving || !teacherUnitId || !teacherSectionId}>{saving ? "Saving…" : "Save teaching progress"}</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="My class delivery history">
        {progress.length ? <div className="space-y-2">{progress.filter((item) => teacherSections.some((section) => section.id === item.section_id)).map((item) => {
          const unit = units.find((entry) => entry.id === item.unit_id);
          return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-800">{unit ? unit.unit_code + " · " + unit.title : "Curriculum unit"}</p><p className="text-xs text-slate-500">{sectionName(item.section_id)} · {unit?.subject_name || ""}</p><p className="text-xs text-slate-500">{item.teacher_note}</p></div><SchoolStatus value={item.status} /></div>;
        })}</div> : <SchoolEmptyState title="No teaching progress submitted" description="Your progress reports will appear after you update a curriculum unit." />}
      </SchoolPanel>
      <div className="flex justify-end"><SchoolSecondaryButton onClick={() => void load()} disabled={loading}>Refresh</SchoolSecondaryButton></div>
    </div>
  );
}
