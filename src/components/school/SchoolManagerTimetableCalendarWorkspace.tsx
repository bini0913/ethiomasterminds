import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, RefreshCw, Plus, Pencil, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  SchoolEmptyState, SchoolField, SchoolMetric, SchoolPageHeading, SchoolPanel, SchoolStatus,
  SchoolPrimaryButton, SchoolSecondaryButton, schoolInputClass, schoolSelectClass, schoolTextareaClass,
} from "@/components/school/SchoolPortalPrimitives";

type Props = {
  schoolId?: string;
  years: any[];
  sections: any[];
  assignments: any[];
  members: any[];
  profiles: Record<string, any>;
};

type ScheduleRow = {
  id: string; school_id: string; academic_year_id: string; section_id: string;
  teacher_membership_id: string; subject_name: string; weekday: number;
  starts_at: string; ends_at: string; room_label: string; effective_from: string;
  effective_until: string | null; status: "scheduled" | "cancelled";
  created_at: string; updated_at: string;
};

type EventRow = {
  id: string; school_id: string; title: string; description: string; event_type: string;
  starts_at: string; ends_at: string; all_day: boolean; location: string;
  audience_type: "school" | "grade" | "section"; grade_label: string | null;
  section_id: string | null; status: "draft" | "published" | "cancelled";
  created_at: string; updated_at: string;
};

const weekdays = [
  { value: 1, label: "Monday" }, { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" }, { value: 6, label: "Saturday" }, { value: 7, label: "Sunday" },
];
const eventTypes = [
  ["academic", "Academic"], ["exam", "Examination"], ["holiday", "Holiday"],
  ["meeting", "Meeting"], ["school_event", "School event"], ["deadline", "Deadline"], ["other", "Other"],
] as const;
const localDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const prettyDate = (value?: string | null) => value ? new Date(value + (value.length === 10 ? "T00:00:00" : "")).toLocaleDateString() : "—";
const prettyTime = (value?: string | null) => value ? value.slice(0, 5) : "—";

const emptySchedule = {
  id: "", academicYearId: "", sectionId: "", teacherMembershipId: "", subjectName: "",
  weekday: "1", startsAt: "08:00", endsAt: "08:40", roomLabel: "",
  effectiveFrom: new Date().toISOString().slice(0, 10), effectiveUntil: "", reason: "New timetable entry",
};
const emptyEvent = {
  id: "", title: "", description: "", eventType: "academic", startsAt: "", endsAt: "",
  allDay: false, location: "", audienceType: "school", gradeLabel: "", sectionId: "",
  status: "draft", reason: "New school calendar event",
};

export default function SchoolManagerTimetableCalendarWorkspace({ schoolId, years, sections, assignments, members, profiles }: Props) {
  const db = supabase as any;
  const [tab, setTab] = useState<"timetable" | "calendar" | "audit">("timetable");
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(emptySchedule);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState("scheduled");
  const [eventStatusFilter, setEventStatusFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [eventFrom, setEventFrom] = useState("");
  const [eventTo, setEventTo] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!schoolId) {
      setSchedules([]); setEvents([]); setAudit([]); setLoading(false); setError("");
      return;
    }
    setLoading(true); setError("");
    try {
      const [scheduleResult, eventResult, auditResult] = await Promise.all([
        db.from("school_schedule_entries").select("*").eq("school_id", schoolId).order("weekday").order("starts_at").limit(2000),
        db.from("school_calendar_events").select("*").eq("school_id", schoolId).order("starts_at", { ascending: true }).limit(2000),
        db.from("school_operations_audit_events").select("id,actor_membership_id,entity_type,entity_id,action_type,reason,before_state,after_state,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(150),
      ]);
      if (requestId !== requestSequence.current) return;
      const failures = [
        scheduleResult.error && "Timetable: " + scheduleResult.error.message,
        eventResult.error && "Calendar: " + eventResult.error.message,
        auditResult.error && "Operations audit: " + auditResult.error.message,
      ].filter(Boolean);
      if (failures.length) throw new Error(failures.join(" · "));
      setSchedules((scheduleResult.data || []) as ScheduleRow[]);
      setEvents((eventResult.data || []) as EventRow[]);
      setAudit(auditResult.data || []);
    } catch (cause) {
      if (requestId === requestSequence.current) setError(cause instanceof Error ? cause.message : "School operations could not be loaded.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [db, schoolId]);

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!scheduleForm.academicYearId && years.length) {
      const current = years.find((year) => year.is_current) || years[0];
      setScheduleForm((form) => ({ ...form, academicYearId: current.id }));
    }
  }, [years, scheduleForm.academicYearId]);

  const selectedSection = sections.find((section) => section.id === scheduleForm.sectionId);
  const availableSections = useMemo(() => sections.filter((section) =>
    !scheduleForm.academicYearId || section.academic_year_id === scheduleForm.academicYearId
  ), [sections, scheduleForm.academicYearId]);
  const sectionAssignments = useMemo(() => assignments.filter((assignment) =>
    assignment.section_id === scheduleForm.sectionId && assignment.assignment_kind === "subject"
  ), [assignments, scheduleForm.sectionId]);
  const subjectOptions = [...new Set(sectionAssignments.map((assignment) => assignment.subject_name).filter(Boolean))].sort();
  const teachersForSubject = sectionAssignments.filter((assignment) =>
    !scheduleForm.subjectName || assignment.subject_name.toLowerCase() === scheduleForm.subjectName.toLowerCase()
  ).map((assignment) => members.find((member) =>
    member.id === assignment.teacher_membership_id && member.school_role === "teacher" && member.status === "active"
  )).filter(Boolean);
  const activeGrades = [...new Set(sections.map((section) => section.grade_label).filter(Boolean))].sort();
  const visibleSchedules = schedules.filter((entry) =>
    (yearFilter === "all" || entry.academic_year_id === yearFilter)
    && (sectionFilter === "all" || entry.section_id === sectionFilter)
    && (scheduleStatusFilter === "all" || entry.status === scheduleStatusFilter)
  );
  const visibleEvents = events.filter((event) =>
    (eventStatusFilter === "all" || event.status === eventStatusFilter)
    && (eventTypeFilter === "all" || event.event_type === eventTypeFilter)
    && (!eventFrom || event.starts_at.slice(0, 10) >= eventFrom)
    && (!eventTo || event.starts_at.slice(0, 10) <= eventTo)
  );
  const activeSchedules = schedules.filter((entry) => entry.status === "scheduled").length;
  const publishedEvents = events.filter((event) => event.status === "published").length;
  const draftEvents = events.filter((event) => event.status === "draft").length;

  const memberName = (membershipId: string) => {
    const member = members.find((item) => item.id === membershipId);
    const profile = member ? profiles[member.user_id] || {} : {};
    return profile.name || profile.full_name || profile.username || member?.school_username || "School member";
  };
  const sectionName = (sectionId: string | null) => {
    const section = sections.find((item) => item.id === sectionId);
    return section ? section.grade_label + " · " + section.section_name : "School-wide";
  };

  const resetSchedule = () => setScheduleForm({ ...emptySchedule, academicYearId: years.find((year) => year.is_current)?.id || years[0]?.id || "" });
  const editSchedule = (entry: ScheduleRow) => {
    setScheduleForm({
      id: entry.id, academicYearId: entry.academic_year_id, sectionId: entry.section_id,
      teacherMembershipId: entry.teacher_membership_id, subjectName: entry.subject_name,
      weekday: String(entry.weekday), startsAt: prettyTime(entry.starts_at), endsAt: prettyTime(entry.ends_at),
      roomLabel: entry.room_label || "", effectiveFrom: entry.effective_from,
      effectiveUntil: entry.effective_until || "", reason: "Updated timetable entry with manager review",
    });
    setTab("timetable");
  };

  const saveSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !scheduleForm.academicYearId || !scheduleForm.sectionId || !scheduleForm.teacherMembershipId || !scheduleForm.subjectName) {
      toast.error("Choose an academic year, class, assigned teacher and subject.");
      return;
    }
    if (scheduleForm.reason.trim().length < 5) return toast.error("Enter a reason of at least 5 characters.");
    setSaving(true);
    try {
      const { error: saveError } = await db.rpc("school_manager_save_schedule_entry", {
        p_school_id: schoolId, p_academic_year_id: scheduleForm.academicYearId,
        p_section_id: scheduleForm.sectionId, p_teacher_membership_id: scheduleForm.teacherMembershipId,
        p_subject_name: scheduleForm.subjectName, p_weekday: Number(scheduleForm.weekday),
        p_starts_at: scheduleForm.startsAt, p_ends_at: scheduleForm.endsAt,
        p_room_label: scheduleForm.roomLabel, p_effective_from: scheduleForm.effectiveFrom,
        p_effective_until: scheduleForm.effectiveUntil || null, p_status: "scheduled",
        p_reason: scheduleForm.reason.trim(), p_entry_id: scheduleForm.id || null,
      });
      if (saveError) throw saveError;
      toast.success(scheduleForm.id ? "Timetable entry updated." : "Timetable entry created.");
      resetSchedule();
      await load();
    } catch (cause: any) {
      toast.error(cause?.message || "The timetable entry could not be saved.");
    } finally { setSaving(false); }
  };

  const cancelSchedule = async (entry: ScheduleRow) => {
    if (!schoolId || !window.confirm("Cancel this timetable entry? Its history will be retained.")) return;
    setSaving(true);
    const { error: saveError } = await db.rpc("school_manager_save_schedule_entry", {
      p_school_id: schoolId, p_academic_year_id: entry.academic_year_id, p_section_id: entry.section_id,
      p_teacher_membership_id: entry.teacher_membership_id, p_subject_name: entry.subject_name,
      p_weekday: entry.weekday, p_starts_at: entry.starts_at, p_ends_at: entry.ends_at,
      p_room_label: entry.room_label || "", p_effective_from: entry.effective_from,
      p_effective_until: entry.effective_until, p_status: "cancelled",
      p_reason: "Cancelled timetable entry after manager review", p_entry_id: entry.id,
    });
    setSaving(false);
    if (saveError) return toast.error(saveError.message || "The timetable entry could not be cancelled.");
    toast.success("Timetable entry cancelled; audit history retained.");
    if (scheduleForm.id === entry.id) resetSchedule();
    await load();
  };

  const editEvent = (event: EventRow) => {
    setEventForm({
      id: event.id, title: event.title, description: event.description || "", eventType: event.event_type,
      startsAt: localDateTime(event.starts_at), endsAt: localDateTime(event.ends_at), allDay: event.all_day,
      location: event.location || "", audienceType: event.audience_type, gradeLabel: event.grade_label || "",
      sectionId: event.section_id || "", status: event.status,
      reason: "Updated calendar event with manager review",
    });
    setTab("calendar");
  };

  const resetEvent = () => setEventForm({ ...emptyEvent, startsAt: "", endsAt: "" });
  const saveEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !eventForm.title.trim() || !eventForm.startsAt || !eventForm.endsAt) {
      toast.error("Enter an event title, start and end date/time.");
      return;
    }
    if (eventForm.reason.trim().length < 5) return toast.error("Enter a reason of at least 5 characters.");
    setSaving(true);
    try {
      const { error: saveError } = await db.rpc("school_manager_save_calendar_event", {
        p_school_id: schoolId, p_title: eventForm.title, p_description: eventForm.description,
        p_event_type: eventForm.eventType, p_starts_at: new Date(eventForm.startsAt).toISOString(),
        p_ends_at: new Date(eventForm.endsAt).toISOString(), p_all_day: eventForm.allDay,
        p_location: eventForm.location, p_audience_type: eventForm.audienceType,
        p_grade_label: eventForm.audienceType === "grade" ? eventForm.gradeLabel : null,
        p_section_id: eventForm.audienceType === "section" ? eventForm.sectionId : null,
        p_status: eventForm.status, p_reason: eventForm.reason.trim(), p_event_id: eventForm.id || null,
      });
      if (saveError) throw saveError;
      toast.success(eventForm.id ? "Calendar event updated." : "Calendar event created.");
      resetEvent();
      await load();
    } catch (cause: any) {
      toast.error(cause?.message || "The calendar event could not be saved.");
    } finally { setSaving(false); }
  };

  const updateEventStatus = async (event: EventRow, status: "published" | "cancelled" | "draft") => {
    setSaving(true);
    const { error: saveError } = await db.rpc("school_manager_save_calendar_event", {
      p_school_id: schoolId, p_title: event.title, p_description: event.description || "",
      p_event_type: event.event_type, p_starts_at: event.starts_at, p_ends_at: event.ends_at,
      p_all_day: event.all_day, p_location: event.location || "", p_audience_type: event.audience_type,
      p_grade_label: event.grade_label, p_section_id: event.section_id, p_status: status,
      p_reason: status === "published" ? "Published calendar event after manager review" : status === "cancelled" ? "Cancelled calendar event after manager review" : "Returned calendar event to draft",
      p_event_id: event.id,
    });
    setSaving(false);
    if (saveError) return toast.error(saveError.message || "The calendar event status could not be changed.");
    toast.success(status === "published" ? "Event published to its selected audience." : status === "cancelled" ? "Event cancelled; history retained." : "Event returned to draft.");
    await load();
  };

  return (
    <div className="space-y-5">
      <SchoolPageHeading
        title="Timetable & school calendar"
        description="Build a real weekly timetable, prevent teacher/class/room overlaps, and publish dated school events to the right audience. All changes are school-scoped and audited."
        action={<SchoolSecondaryButton onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh operations</SchoolSecondaryButton>}
      />
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <SchoolMetric label="Active timetable entries" value={activeSchedules} detail="Recurring weekly lessons" icon={Clock3} />
        <SchoolMetric label="Published calendar events" value={publishedEvents} detail="Visible to selected audiences" icon={CalendarCheck} />
        <SchoolMetric label="Draft events" value={draftEvents} detail="Not yet visible to students or families" icon={CalendarDays} />
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(["timetable", "calendar", "audit"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} aria-pressed={tab === item}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === item ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {item === "timetable" ? "Weekly timetable" : item === "calendar" ? "Calendar events" : "Operations audit"}
          </button>
        ))}
      </div>

      {tab === "timetable" && (
        <div className="space-y-5">
          <SchoolPanel title={scheduleForm.id ? "Edit timetable entry" : "Add timetable entry"} description="The database validates teacher assignments and prevents overlapping lessons for the same teacher, class or room across the effective date range.">
            <form onSubmit={saveSchedule} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <SchoolField label="Academic year">
                <select className={schoolSelectClass} value={scheduleForm.academicYearId} onChange={(e) => setScheduleForm((f) => ({ ...f, academicYearId: e.target.value, sectionId: "", teacherMembershipId: "", subjectName: "" }))} required>
                  <option value="">Choose year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.is_current ? " · Current" : ""}</option>)}
                </select>
              </SchoolField>
              <SchoolField label="Class / section">
                <select className={schoolSelectClass} value={scheduleForm.sectionId} onChange={(e) => setScheduleForm((f) => ({ ...f, sectionId: e.target.value, teacherMembershipId: "", subjectName: "" }))} required>
                  <option value="">Choose section</option>{availableSections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} · {section.section_name}</option>)}
                </select>
              </SchoolField>
              <SchoolField label="Subject">
                <select className={schoolSelectClass} value={scheduleForm.subjectName} onChange={(e) => setScheduleForm((f) => ({ ...f, subjectName: e.target.value, teacherMembershipId: "" }))} required>
                  <option value="">Choose assigned subject</option>{subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
              </SchoolField>
              <SchoolField label="Assigned teacher">
                <select className={schoolSelectClass} value={scheduleForm.teacherMembershipId} onChange={(e) => setScheduleForm((f) => ({ ...f, teacherMembershipId: e.target.value }))} required>
                  <option value="">Choose assigned teacher</option>{teachersForSubject.map((teacher) => <option key={teacher.id} value={teacher.id}>{memberName(teacher.id)}</option>)}
                </select>
              </SchoolField>
              <SchoolField label="Weekday">
                <select className={schoolSelectClass} value={scheduleForm.weekday} onChange={(e) => setScheduleForm((f) => ({ ...f, weekday: e.target.value }))}>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select>
              </SchoolField>
              <SchoolField label="Room (optional)">
                <input className={schoolInputClass} value={scheduleForm.roomLabel} maxLength={100} onChange={(e) => setScheduleForm((f) => ({ ...f, roomLabel: e.target.value }))} placeholder="e.g. Room 204" />
              </SchoolField>
              <SchoolField label="Starts">
                <input className={schoolInputClass} type="time" value={scheduleForm.startsAt} onChange={(e) => setScheduleForm((f) => ({ ...f, startsAt: e.target.value }))} required />
              </SchoolField>
              <SchoolField label="Ends">
                <input className={schoolInputClass} type="time" value={scheduleForm.endsAt} onChange={(e) => setScheduleForm((f) => ({ ...f, endsAt: e.target.value }))} required />
              </SchoolField>
              <SchoolField label="Effective from">
                <input className={schoolInputClass} type="date" value={scheduleForm.effectiveFrom} onChange={(e) => setScheduleForm((f) => ({ ...f, effectiveFrom: e.target.value }))} required />
              </SchoolField>
              <SchoolField label="Effective until (optional)">
                <input className={schoolInputClass} type="date" value={scheduleForm.effectiveUntil} onChange={(e) => setScheduleForm((f) => ({ ...f, effectiveUntil: e.target.value }))} />
              </SchoolField>
              <div className="md:col-span-2 xl:col-span-3">
                <SchoolField label="Reason for this change">
                  <input className={schoolInputClass} value={scheduleForm.reason} onChange={(e) => setScheduleForm((f) => ({ ...f, reason: e.target.value }))} minLength={5} maxLength={1000} required />
                </SchoolField>
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3">
                <SchoolPrimaryButton type="submit" disabled={saving || !selectedSection}><Plus className="mr-2 h-4 w-4" />{saving ? "Saving…" : scheduleForm.id ? "Save timetable entry" : "Add timetable entry"}</SchoolPrimaryButton>
                {scheduleForm.id && <SchoolSecondaryButton onClick={resetSchedule}>Stop editing</SchoolSecondaryButton>}
              </div>
            </form>
          </SchoolPanel>
          <SchoolPanel title="Weekly timetable" description="Entries are recurring by weekday within their effective date range. Cancelled records remain available for history.">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <SchoolField label="Academic year"><select className={schoolSelectClass} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}><option value="all">All years</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
              <SchoolField label="Section"><select className={schoolSelectClass} value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}><option value="all">All sections</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} · {section.section_name}</option>)}</select></SchoolField>
              <SchoolField label="Status"><select className={schoolSelectClass} value={scheduleStatusFilter} onChange={(e) => setScheduleStatusFilter(e.target.value)}><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option><option value="all">All statuses</option></select></SchoolField>
            </div>
            {visibleSchedules.length ? <div className="space-y-3">{visibleSchedules.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{entry.subject_name}</p><SchoolStatus value={entry.status} /></div>
                    <p className="mt-1 text-sm text-slate-600">{sectionName(entry.section_id)} · {memberName(entry.teacher_membership_id)}</p>
                    <p className="mt-1 text-sm text-slate-600">{weekdays.find((day) => day.value === entry.weekday)?.label} · {prettyTime(entry.starts_at)}–{prettyTime(entry.ends_at)}{entry.room_label ? " · " + entry.room_label : ""}</p>
                    <p className="mt-1 text-xs text-slate-500">Effective {prettyDate(entry.effective_from)} – {entry.effective_until ? prettyDate(entry.effective_until) : "No end date"}</p>
                  </div>
                  {entry.status === "scheduled" && <div className="flex gap-2"><SchoolSecondaryButton onClick={() => editSchedule(entry)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</SchoolSecondaryButton><SchoolSecondaryButton onClick={() => void cancelSchedule(entry)}>Cancel</SchoolSecondaryButton></div>}
                </div>
              </div>
            ))}</div> : <SchoolEmptyState title="No timetable entries match these filters" description="Add a lesson above. The school timetable starts empty; no sample lessons are created." />}
          </SchoolPanel>
        </div>
      )}

      {tab === "calendar" && (
        <div className="space-y-5">
          <SchoolPanel title={eventForm.id ? "Edit calendar event" : "Create calendar event"} description="Draft events stay private to school management. Publish only when details and audience are correct.">
            <form onSubmit={saveEvent} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <SchoolField label="Event title"><input className={schoolInputClass} value={eventForm.title} maxLength={180} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} required /></SchoolField>
              <SchoolField label="Event type"><select className={schoolSelectClass} value={eventForm.eventType} onChange={(e) => setEventForm((f) => ({ ...f, eventType: e.target.value }))}>{eventTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></SchoolField>
              <SchoolField label="Status"><select className={schoolSelectClass} value={eventForm.status} onChange={(e) => setEventForm((f) => ({ ...f, status: e.target.value }))}><option value="draft">Draft</option><option value="published">Published</option><option value="cancelled">Cancelled</option></select></SchoolField>
              <SchoolField label="Starts"><input className={schoolInputClass} type="datetime-local" value={eventForm.startsAt} onChange={(e) => setEventForm((f) => ({ ...f, startsAt: e.target.value }))} required /></SchoolField>
              <SchoolField label="Ends"><input className={schoolInputClass} type="datetime-local" value={eventForm.endsAt} onChange={(e) => setEventForm((f) => ({ ...f, endsAt: e.target.value }))} required /></SchoolField>
              <SchoolField label="Location (optional)"><input className={schoolInputClass} value={eventForm.location} maxLength={180} onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))} placeholder="School hall, classroom…" /></SchoolField>
              <SchoolField label="Audience"><select className={schoolSelectClass} value={eventForm.audienceType} onChange={(e) => setEventForm((f) => ({ ...f, audienceType: e.target.value, gradeLabel: "", sectionId: "" }))}><option value="school">Whole school</option><option value="grade">One grade</option><option value="section">One section</option></select></SchoolField>
              {eventForm.audienceType === "grade" && <SchoolField label="Grade"><select className={schoolSelectClass} value={eventForm.gradeLabel} onChange={(e) => setEventForm((f) => ({ ...f, gradeLabel: e.target.value }))} required><option value="">Choose grade</option>{activeGrades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></SchoolField>}
              {eventForm.audienceType === "section" && <SchoolField label="Section"><select className={schoolSelectClass} value={eventForm.sectionId} onChange={(e) => setEventForm((f) => ({ ...f, sectionId: e.target.value }))} required><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} · {section.section_name}</option>)}</select></SchoolField>}
              <div className="md:col-span-2 xl:col-span-3"><SchoolField label="Description"><textarea className={schoolTextareaClass} rows={3} maxLength={4000} value={eventForm.description} onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))} /></SchoolField></div>
              <div className="md:col-span-2 xl:col-span-3"><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={eventForm.allDay} onChange={(e) => setEventForm((f) => ({ ...f, allDay: e.target.checked }))} />All-day event</label></div>
              <div className="md:col-span-2 xl:col-span-3"><SchoolField label="Reason for this change"><input className={schoolInputClass} value={eventForm.reason} onChange={(e) => setEventForm((f) => ({ ...f, reason: e.target.value }))} minLength={5} maxLength={1000} required /></SchoolField></div>
              <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3"><SchoolPrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : eventForm.id ? "Save event" : "Create event"}</SchoolPrimaryButton>{eventForm.id && <SchoolSecondaryButton onClick={resetEvent}>Stop editing</SchoolSecondaryButton>}</div>
            </form>
          </SchoolPanel>
          <SchoolPanel title="School calendar" description="Published events are visible to their selected audience; draft and cancelled events remain in the manager workspace.">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SchoolField label="Status"><select className={schoolSelectClass} value={eventStatusFilter} onChange={(e) => setEventStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="cancelled">Cancelled</option></select></SchoolField>
              <SchoolField label="Type"><select className={schoolSelectClass} value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)}><option value="all">All types</option>{eventTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></SchoolField>
              <SchoolField label="From"><input className={schoolInputClass} type="date" value={eventFrom} onChange={(e) => setEventFrom(e.target.value)} /></SchoolField>
              <SchoolField label="To"><input className={schoolInputClass} type="date" value={eventTo} onChange={(e) => setEventTo(e.target.value)} /></SchoolField>
            </div>
            {visibleEvents.length ? <div className="space-y-3">{visibleEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{event.title}</p><SchoolStatus value={event.status} /></div>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-blue-700">{event.event_type.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-sm text-slate-600">{new Date(event.starts_at).toLocaleString()} – {new Date(event.ends_at).toLocaleString()}</p>
                    <p className="mt-1 text-sm text-slate-600">{event.audience_type === "school" ? "Whole school" : event.audience_type === "grade" ? event.grade_label : sectionName(event.section_id)}{event.location ? " · " + event.location : ""}</p>
                    {event.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{event.description}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2"><SchoolSecondaryButton onClick={() => editEvent(event)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</SchoolSecondaryButton>{event.status === "draft" && <SchoolPrimaryButton onClick={() => void updateEventStatus(event, "published")} disabled={saving}>Publish</SchoolPrimaryButton>}{event.status === "published" && <SchoolSecondaryButton onClick={() => void updateEventStatus(event, "cancelled")} disabled={saving}>Cancel event</SchoolSecondaryButton>}</div>
                </div>
              </div>
            ))}</div> : <SchoolEmptyState title="No calendar events match these filters" description="Create a draft event above. Nothing is published until a manager explicitly publishes it." />}
          </SchoolPanel>
        </div>
      )}

      {tab === "audit" && (
        <SchoolPanel title="Timetable and calendar audit" description="Every create, edit, publish, cancellation and return-to-draft action is recorded with its reason and before/after state.">
          {audit.length ? <div className="space-y-3">{audit.map((item) => (
            <div key={item.id} className="border-b border-slate-100 pb-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold capitalize text-slate-900">{item.action_type} · {item.entity_type.replace(/_/g, " ")}</p><span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</span></div>
              <p className="mt-1 text-sm text-slate-600">{memberName(item.actor_membership_id)} · {item.reason}</p>
              <p className="mt-1 text-xs text-slate-500">Record: {item.entity_id}</p>
            </div>
          ))}</div> : <SchoolEmptyState title="No timetable or calendar changes yet" description="Manager changes will be recorded here after the first schedule or event is saved." />}
        </SchoolPanel>
      )}
      {loading && <p className="text-xs text-slate-500">Refreshing school operations…</p>}
      <p className="text-xs text-slate-500">Timetable entries are recurring weekly rules, not bell-time proof or teacher attendance. Calendar publication does not send notifications unless a separate notification workflow is configured.</p>
    </div>
  );
}
