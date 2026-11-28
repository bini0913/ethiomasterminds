import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, ClipboardCheck, ClipboardList, FileText, GraduationCap, Library, RefreshCw, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SchoolEmptyState, SchoolField, SchoolMetric, SchoolPageHeading, SchoolPanel, SchoolStatus,
  SchoolSecondaryButton, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";

type AcademicWorkspaceProps = {
  schoolId?: string;
  years: any[];
  terms: any[];
  sections: any[];
  subjects: any[];
  assignments: any[];
  categories: any[];
  gradingPolicies: any[];
  members: any[];
  profiles: Record<string, any>;
};

type AcademicRows = {
  assessments: any[];
  marks: any[];
  results: any[];
  homework: any[];
  submissions: any[];
  quizzes: any[];
  books: any[];
  catalog: any[];
};

const emptyRows: AcademicRows = {
  assessments: [], marks: [], results: [], homework: [], submissions: [],
  quizzes: [], books: [], catalog: [],
};

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : "—";
const gradeNumber = (label?: string | null) => {
  const match = String(label || "").match(/(?:grade|class)\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

export default function SchoolManagerAcademicWorkspace({
  schoolId, years, terms, sections, subjects, assignments, categories, gradingPolicies, members, profiles,
}: AcademicWorkspaceProps) {
  const db = supabase as any;
  const [rows, setRows] = useState<AcademicRows>(emptyRows);
  const [loading, setLoading] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedSectionId, setSelectedSectionId] = useState("all");

  useEffect(() => {
    if (!selectedYearId && years.length) {
      setSelectedYearId(years.find((year) => year.is_current)?.id || years[0].id);
    }
  }, [years, selectedYearId]);

  const load = useCallback(async () => {
    if (!schoolId) {
      setRows(emptyRows);
      return;
    }
    setLoading(true);
    const requests = await Promise.all([
      db.from("school_assessments").select("id,academic_year_id,term_id,section_id,category_id,subject_name,title,max_score,due_at,status,created_by_membership_id,review_feedback,created_at,reviewed_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(500),
      db.from("school_student_marks").select("id,assessment_id,student_membership_id,score,status,teacher_note,updated_at").eq("school_id", schoolId).order("updated_at", { ascending: false }).limit(2000),
      db.from("school_term_results").select("id,term_id,student_membership_id,section_id,grade_label,subject_name,average_score,letter_grade,rank_position,status,calculated_at,published_at").eq("school_id", schoolId).order("updated_at", { ascending: false }).limit(1500),
      db.from("school_homework_assignments").select("id,section_id,teacher_membership_id,subject_name,title,due_at,status,review_feedback,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(500),
      db.from("school_homework_submissions").select("id,homework_id,student_membership_id,status,grade,submitted_at,graded_at,feedback").eq("school_id", schoolId).order("submitted_at", { ascending: false }).limit(2000),
      db.from("quizzes").select("id,title,subject,grade,school_section_id,school_review_status,source_kind,source_name,source_year,source_verification_status,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(500),
      db.from("library_books").select("id,title,author,subject,grade_level,school_grade_label,school_section_id,status,school_review_status,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(500),
      db.from("curriculum_textbook_catalog").select("id,grade_level,curriculum_year_ec,subject,book_title,resource_type,source_name,source_status,source_url,official_portal_url,notes").order("grade_level").order("subject").limit(500),
    ]);
    const labels = ["Assessments", "Student marks", "Term results", "Homework", "Homework submissions", "School quizzes", "School library", "National textbook catalog"];
    const errors = requests.flatMap((request, index) => request.error ? [labels[index] + ": " + request.error.message] : []);
    setLoadErrors(errors);
    setRows({
      assessments: requests[0].data || [],
      marks: requests[1].data || [],
      results: requests[2].data || [],
      homework: requests[3].data || [],
      submissions: requests[4].data || [],
      quizzes: requests[5].data || [],
      books: requests[6].data || [],
      catalog: requests[7].data || [],
    });
    setLoading(false);
  }, [db, schoolId]);

  useEffect(() => { void load(); }, [load]);

  const filteredSections = useMemo(() => sections.filter((section) =>
    (!selectedYearId || section.academic_year_id === selectedYearId) &&
    (selectedGrade === "all" || section.grade_label === selectedGrade)
  ), [sections, selectedYearId, selectedGrade]);

  const inScope = useCallback((sectionId?: string | null, termId?: string | null, yearId?: string | null, gradeLabel?: string | null) => {
    const section = sections.find((item) => item.id === sectionId);
    const term = terms.find((item) => item.id === termId);
    const effectiveYear = yearId || term?.academic_year_id || section?.academic_year_id;
    const effectiveGrade = gradeLabel || section?.grade_label;
    return (!selectedYearId || effectiveYear === selectedYearId)
      && (!selectedTermId || termId === selectedTermId)
      && (selectedGrade === "all" || effectiveGrade === selectedGrade)
      && (selectedSectionId === "all" || sectionId === selectedSectionId);
  }, [sections, terms, selectedYearId, selectedTermId, selectedGrade, selectedSectionId]);

  const assessments = useMemo(() => rows.assessments.filter((item) => inScope(item.section_id, item.term_id, item.academic_year_id)), [rows.assessments, inScope]);
  const assessmentIds = useMemo(() => new Set(assessments.map((item) => item.id)), [assessments]);
  const marks = useMemo(() => rows.marks.filter((item) => assessmentIds.has(item.assessment_id)), [rows.marks, assessmentIds]);
  const results = useMemo(() => rows.results.filter((item) => inScope(item.section_id, item.term_id, null, item.grade_label)), [rows.results, inScope]);
  const homework = useMemo(() => rows.homework.filter((item) => inScope(item.section_id)), [rows.homework, inScope]);
  const homeworkIds = useMemo(() => new Set(homework.map((item) => item.id)), [homework]);
  const submissions = useMemo(() => rows.submissions.filter((item) => homeworkIds.has(item.homework_id)), [rows.submissions, homeworkIds]);
  const scopedQuizzes = useMemo(() => rows.quizzes.filter((item) => inScope(item.school_section_id, null, null, item.grade)), [rows.quizzes, inScope]);
  const scopedBooks = useMemo(() => rows.books.filter((item) => inScope(item.school_section_id, null, null, item.school_grade_label)), [rows.books, inScope]);

  const memberName = (membershipId?: string | null) => {
    const member = members.find((item) => item.id === membershipId);
    if (!member) return "School member";
    const profile = profiles[member.user_id];
    return profile?.name || profile?.username || member.school_username || "School member";
  };
  const sectionName = (sectionId?: string | null) => {
    const section = sections.find((item) => item.id === sectionId);
    return section ? section.grade_label + " " + section.section_name : "Section unavailable";
  };
  const categoryName = (categoryId?: string | null) => categories.find((item) => item.id === categoryId)?.category_name || "Category unavailable";

  const pendingAssessments = assessments.filter((item) => item.status === "submitted").length;
  const approvedAssessments = assessments.filter((item) => item.status === "approved" || item.status === "published").length;
  const publishedResults = results.filter((item) => item.status === "published").length;
  const pendingHomework = homework.filter((item) => item.status === "pending").length;
  const awaitingSubmissions = submissions.filter((item) => item.status === "submitted").length;
  const pendingContent = scopedQuizzes.filter((item) => item.school_review_status === "pending").length + scopedBooks.filter((item) => item.school_review_status === "pending").length;

  const subjectCoverage = useMemo(() => {
    return filteredSections.map((section) => {
      const activeSubjects = subjects.filter((subject) => subject.active && subject.academic_year_id === section.academic_year_id && subject.grade_label === section.grade_label);
      const assignedSubjects = activeSubjects.filter((subject) => assignments.some((assignment) =>
        assignment.section_id === section.id && assignment.assignment_kind === "subject" && assignment.subject_name === subject.subject_name
      ));
      return { section, activeSubjects, assignedSubjects };
    });
  }, [filteredSections, subjects, assignments]);

  const teacherActivity = useMemo(() => {
    const totals = new Map<string, { teacherId: string; assessments: number; approved: number; marks: number }>();
    for (const item of assessments) {
      const teacherId = item.created_by_membership_id;
      const current = totals.get(teacherId) || { teacherId, assessments: 0, approved: 0, marks: 0 };
      current.assessments += 1;
      if (["approved", "published"].includes(item.status)) current.approved += 1;
      current.marks += marks.filter((mark) => mark.assessment_id === item.id).length;
      totals.set(teacherId, current);
    }
    return [...totals.values()].sort((a, b) => b.assessments - a.assessments).slice(0, 12);
  }, [assessments, marks]);

  const followUpRows = useMemo(() => results.filter((result) => {
    if (result.status !== "published" || result.average_score == null) return false;
    const policy = gradingPolicies.find((item) => item.grade_label === result.grade_label && item.academic_year_id === terms.find((term) => term.id === result.term_id)?.academic_year_id);
    return policy && Number(result.average_score) < Number(policy.pass_mark);
  }).sort((a, b) => Number(a.average_score) - Number(b.average_score)).slice(0, 20), [results, gradingPolicies, terms]);

  const catalogRows = useMemo(() => rows.catalog.filter((item) =>
    selectedGrade === "all" || gradeNumber(selectedGrade) === Number(item.grade_level)
  ).slice(0, 30), [rows.catalog, selectedGrade]);

  return (
    <div className="space-y-5">
      <SchoolPageHeading
        title="Academic management"
        description="School-scoped oversight of assessments, marks, term results, homework, curriculum references, and learning resources."
        action={<SchoolSecondaryButton onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{loading ? "Refreshing…" : "Refresh records"}</SchoolSecondaryButton>}
      />

      {loadErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Some academic records could not be loaded. Counts and lists for those sources may be incomplete.
          <ul className="mt-2 list-disc pl-5">{loadErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      <SchoolPanel title="Academic scope" description="Choose the academic year, term, grade, and section used by the reports below.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SchoolField label="Academic year">
            <select className={schoolSelectClass} value={selectedYearId} onChange={(event) => { setSelectedYearId(event.target.value); setSelectedTermId(""); }}>
              <option value="">All academic years</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.is_current ? " · Current" : ""}</option>)}
            </select>
          </SchoolField>
          <SchoolField label="Term">
            <select className={schoolSelectClass} value={selectedTermId} onChange={(event) => setSelectedTermId(event.target.value)}>
              <option value="">All terms</option>
              {terms.filter((term) => !selectedYearId || term.academic_year_id === selectedYearId).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
            </select>
          </SchoolField>
          <SchoolField label="Grade">
            <select className={schoolSelectClass} value={selectedGrade} onChange={(event) => { setSelectedGrade(event.target.value); setSelectedSectionId("all"); }}>
              <option value="all">All grades</option>
              {[...new Set(sections.filter((section) => !selectedYearId || section.academic_year_id === selectedYearId).map((section) => section.grade_label))].sort().map((grade) => <option key={grade} value={grade}>{grade}</option>)}
            </select>
          </SchoolField>
          <SchoolField label="Section">
            <select className={schoolSelectClass} value={selectedSectionId} onChange={(event) => setSelectedSectionId(event.target.value)}>
              <option value="all">All sections</option>
              {filteredSections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}
            </select>
          </SchoolField>
        </div>
      </SchoolPanel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Assessments" value={assessments.length} detail={pendingAssessments + " awaiting academic review"} icon={ClipboardCheck} />
        <SchoolMetric label="Approved assessments" value={approvedAssessments} detail={marks.length + " recorded mark rows"} icon={FileText} />
        <SchoolMetric label="Published subject results" value={publishedResults} detail={results.length + " calculated or published rows"} icon={TrendingUp} />
        <SchoolMetric label="Homework" value={homework.length} detail={pendingHomework + " awaiting review"} icon={ClipboardList} />
        <SchoolMetric label="Student submissions" value={submissions.length} detail={awaitingSubmissions + " awaiting teacher grading"} icon={Users} />
        <SchoolMetric label="Learning resources" value={scopedBooks.length} detail={scopedBooks.filter((item) => item.school_review_status === "approved").length + " approved school resources"} icon={Library} />
        <SchoolMetric label="School quizzes" value={scopedQuizzes.length} detail={pendingContent + " resources awaiting academic review"} icon={BookOpen} />
        <SchoolMetric label="Textbook references" value={catalogRows.length} detail="Catalog entries matching this grade filter" icon={GraduationCap} />
      </div>

      <SchoolPanel title="Assessment oversight" description="Review the real assessment workflow and its status. Approval remains restricted to the existing authorized academic-leader RPC.">
        {assessments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Assessment</th><th className="pb-2">Class</th><th className="pb-2">Subject / category</th><th className="pb-2">Teacher</th><th className="pb-2">Marks</th><th className="pb-2">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{assessments.slice(0, 40).map((item) => <tr key={item.id}>
            <td className="py-3"><p className="font-medium text-slate-800">{item.title}</p><p className="text-xs text-slate-500">Max {item.max_score} · Due {formatDate(item.due_at)}</p>{item.review_feedback && <p className="mt-1 text-xs text-amber-700">{item.review_feedback}</p>}</td>
            <td className="py-3 text-slate-600">{sectionName(item.section_id)}</td>
            <td className="py-3 text-slate-600">{item.subject_name}<p className="text-xs text-slate-400">{categoryName(item.category_id)}</p></td>
            <td className="py-3 text-slate-600">{memberName(item.created_by_membership_id)}</td>
            <td className="py-3 tabular-nums text-slate-600">{marks.filter((mark) => mark.assessment_id === item.id).length}</td>
            <td className="py-3"><SchoolStatus value={item.status} /></td>
          </tr>)}</tbody>
        </table></div> : <SchoolEmptyState title="No assessments in this scope" description="Teacher-created assessments will appear here when they are submitted to the school workflow." />}
        {pendingAssessments > 0 && <p className="mt-3 rounded-md border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="mr-1 inline h-4 w-4" />{pendingAssessments} assessment(s) await review by the Manager or an appointed academic leader with the required review permission. This view does not bypass approval controls.</p>}
      </SchoolPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Term results" description="Calculated and published results, scoped to the selected academic period.">
          {results.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Grade / subject</th><th className="pb-2">Average</th><th className="pb-2">Rank</th><th className="pb-2">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{results.slice(0, 30).map((result) => <tr key={result.id}>
              <td className="py-3 font-medium text-slate-800">{memberName(result.student_membership_id)}</td>
              <td className="py-3 text-slate-600">{result.grade_label}<p className="text-xs text-slate-400">{result.subject_name}</p></td>
              <td className="py-3 tabular-nums text-slate-700">{result.average_score == null ? "Incomplete" : Number(result.average_score).toFixed(2) + "%"}</td>
              <td className="py-3 tabular-nums text-slate-600">{result.rank_position ?? "—"}</td>
              <td className="py-3"><SchoolStatus value={result.status} /></td>
            </tr>)}</tbody>
          </table></div> : <SchoolEmptyState title="No term results yet" description="Term results will appear after authorized calculation and publication workflows run." />}
        </SchoolPanel>
        <SchoolPanel title="Academic follow-up candidates" description="Published subject results below the pass mark configured for that grade and academic year. No thresholds are invented.">
          {followUpRows.length ? <div className="space-y-2">{followUpRows.map((result) => {
            const policy = gradingPolicies.find((item) => item.grade_label === result.grade_label && item.academic_year_id === terms.find((term) => term.id === result.term_id)?.academic_year_id);
            return <div key={result.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-100 bg-amber-50/40 p-3">
              <div><p className="text-sm font-semibold text-slate-800">{memberName(result.student_membership_id)}</p><p className="text-xs text-slate-500">{result.grade_label} · {result.subject_name} · pass mark {policy?.pass_mark}%</p></div>
              <p className="text-sm font-semibold tabular-nums text-amber-800">{Number(result.average_score).toFixed(2)}%</p>
            </div>;
          })}</div> : <SchoolEmptyState title="No below-pass published results in this scope" description="This list only includes published results with an explicit grading policy and a score below that configured pass mark." />}
        </SchoolPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Homework and submissions" description="Monitor teacher assignments and student work without changing teacher grading records.">
          {homework.length ? <div className="space-y-3">{homework.slice(0, 30).map((item) => {
            const related = submissions.filter((submission) => submission.homework_id === item.id);
            return <div key={item.id} className="rounded-md border border-slate-100 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{sectionName(item.section_id)} · {item.subject_name} · {memberName(item.teacher_membership_id)}</p><p className="mt-1 text-xs text-slate-400">Due {formatDate(item.due_at)} · {related.length} submission(s)</p></div><SchoolStatus value={item.status} /></div>
              {item.review_feedback && <p className="mt-2 text-xs text-amber-700">{item.review_feedback}</p>}
            </div>;
          })}</div> : <SchoolEmptyState title="No homework records in this scope" description="Teacher homework and student submissions will appear when created." />}
        </SchoolPanel>
        <SchoolPanel title="Teacher academic activity" description="Counts are based on real assessments created by active school teacher memberships. They are workload indicators, not performance ratings.">
          {teacherActivity.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Teacher</th><th className="pb-2">Assessments</th><th className="pb-2">Approved</th><th className="pb-2">Marks</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{teacherActivity.map((item) => <tr key={item.teacherId}><td className="py-3 font-medium text-slate-800">{memberName(item.teacherId)}</td><td className="py-3 tabular-nums text-slate-600">{item.assessments}</td><td className="py-3 tabular-nums text-slate-600">{item.approved}</td><td className="py-3 tabular-nums text-slate-600">{item.marks}</td></tr>)}</tbody>
          </table></div> : <SchoolEmptyState title="No teacher assessment activity" description="Teacher assessment activity will be summarized here after real assessments are created." />}
        </SchoolPanel>
      </div>

      <SchoolPanel title="Subject coverage by section" description="Shows active subjects and teacher assignments for each configured section. This is not a lesson-by-lesson curriculum completion claim.">
        {subjectCoverage.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Section</th><th className="pb-2">Active subjects</th><th className="pb-2">Assigned subjects</th><th className="pb-2">Coverage</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{subjectCoverage.map(({ section, activeSubjects, assignedSubjects }) => <tr key={section.id}>
            <td className="py-3 font-medium text-slate-800">{sectionName(section.id)}</td>
            <td className="py-3 text-slate-600">{activeSubjects.length}</td>
            <td className="py-3 text-slate-600">{assignedSubjects.length}</td>
            <td className="py-3 text-slate-600">{activeSubjects.length ? Math.round(assignedSubjects.length / activeSubjects.length * 100) + "%" : "No active subjects"}</td>
          </tr>)}</tbody>
        </table></div> : <SchoolEmptyState title="No school sections configured" description="Create sections and active subjects in School Structure to see subject coverage." />}
      </SchoolPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="School learning resources" description="School-specific quizzes and library books, with their actual review states.">
          {scopedQuizzes.length || scopedBooks.length ? <div className="space-y-2">
            {scopedQuizzes.slice(0, 15).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 p-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="text-xs text-slate-500">Quiz · {item.grade} · {item.subject}{item.source_name ? " · " + item.source_name : ""}</p>{item.source_verification_status && <p className="text-xs text-slate-400">Source verification: {item.source_verification_status}</p>}</div><SchoolStatus value={item.school_review_status || "unknown"} /></div>)}
            {scopedBooks.slice(0, 15).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 p-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="text-xs text-slate-500">Library · {item.school_grade_label || item.grade_level || "Grade not set"} · {item.subject}</p></div><SchoolStatus value={item.school_review_status || item.status || "unknown"} /></div>)}
          </div> : <SchoolEmptyState title="No school learning resources" description="School-linked quizzes and library resources will appear after teachers submit them." />}
        </SchoolPanel>
        <SchoolPanel title="Ethiopian textbook reference catalog" description="Reference entries from the shared catalog. These records are not the same as a school's uploaded or assigned textbooks.">
          {catalogRows.length ? <div className="space-y-2">{catalogRows.map((item) => <div key={item.id} className="rounded-md border border-slate-100 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800">{item.book_title}</p><p className="mt-1 text-xs text-slate-500">Grade {item.grade_level} · {item.subject} · {item.resource_type}</p><p className="mt-1 text-xs text-slate-400">{item.source_name || "Source not specified"}{item.curriculum_year_ec ? " · " + item.curriculum_year_ec + " E.C." : ""}</p></div><SchoolStatus value={item.source_status || "unverified"} /></div>
            {item.official_portal_url && <a className="mt-2 inline-block text-xs font-semibold text-blue-700 underline" href={item.official_portal_url} target="_blank" rel="noreferrer">Official portal reference</a>}
          </div>)}</div> : <SchoolEmptyState title="No catalog references for this grade" description="The shared textbook catalog has no entries matching the selected grade." />}
        </SchoolPanel>
      </div>
    </div>
  );
}
