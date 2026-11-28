import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, RefreshCw, Plus, CalendarClock, Megaphone, Users, ShieldAlert, BookOpen, CheckCircle2, XCircle } from "lucide-react";
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
  members: any[];
  profiles: Record<string, any>;
};
type Slot = {
  id: string; school_id: string; academic_year_id: string; section_id: string;
  teacher_membership_id: string | null; subject_name: string; weekday: number;
  starts_at: string; ends_at: string; room_label: string | null; active: boolean; notes: string | null;
};
type EventRow = {
  id: string; school_id: string; academic_year_id: string | null; title: string; description: string | null;
  event_type: string; audience_type: string; grade_label: string | null; section_id: string | null;
  starts_at: string; ends_at: string; all_day: boolean; location: string | null; status: string;
};
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";
const dateOnly = (value?: string | null) => value ? new Date(value).toLocaleDateString() : "—";
const timeOnly = (value?: string | null) => value ? value.slice(0, 5) : "—";

export default function SchoolManagerOperationsWorkspace({ schoolId, years, sections, members, profiles }: Props) {
  const db = supabase as any;
  const [slots, setSlots] = useState<Slot[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [parentLinks, setParentLinks] = useState<any[]>([]);
  const [parentNotifications, setParentNotifications] = useState<any[]>([]);
  const [behaviorReports, setBehaviorReports] = useState<any[]>([]);
  const [disciplineItems, setDisciplineItems] = useState<any[]>([]);
  const [contentReviews, setContentReviews] = useState<any[]>([]);
  const [schoolBooks, setSchoolBooks] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("timetable");
  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [slotYear, setSlotYear] = useState("");
  const [slotSection, setSlotSection] = useState("");
  const [slotTeacher, setSlotTeacher] = useState("");
  const [slotSubject, setSlotSubject] = useState("");
  const [slotDay, setSlotDay] = useState("1");
  const [slotStart, setSlotStart] = useState("08:00");
  const [slotEnd, setSlotEnd] = useState("08:45");
  const [slotRoom, setSlotRoom] = useState("");
  const [slotNotes, setSlotNotes] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventType, setEventType] = useState("school_event");
  const [eventAudience, setEventAudience] = useState("school");
  const [eventGrade, setEventGrade] = useState("");
  const [eventSection, setEventSection] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventAllDay, setEventAllDay] = useState(false);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!schoolId) { setSlots([]); setEvents([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const queries = await Promise.all([
        db.from("school_timetable_slots").select("id,school_id,academic_year_id,section_id,teacher_membership_id,subject_name,weekday,starts_at,ends_at,room_label,active,notes").eq("school_id", schoolId).order("weekday").order("starts_at"),
        db.from("school_calendar_events").select("id,school_id,academic_year_id,title,description,event_type,audience_type,grade_label,section_id,starts_at,ends_at,all_day,location,status").eq("school_id", schoolId).order("starts_at", { ascending: true }).limit(300),
        db.from("school_announcements").select("id,title,body,audience_type,grade_label,section_id,status,created_at,published_at,review_feedback").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
        db.from("school_parent_student_links").select("id,parent_membership_id,student_membership_id,status,linked_at,ended_at").eq("school_id", schoolId).order("linked_at", { ascending: false }).limit(500),
        db.from("school_parent_notifications").select("id,parent_membership_id,student_membership_id,notification_type,title,read_at,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(300),
        db.from("school_behavior_reports").select("id,student_membership_id,section_id,report_type,severity,description,status,created_at,reviewed_at,review_note").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200),
        db.from("school_disciplinary_recommendations").select("id,target_membership_id,target_kind,reason,recommendation,status,decision_note,created_at,reviewed_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200),
        db.from("school_content_review_events").select("id,content_type,content_id,submitted_by_membership_id,reviewed_by_membership_id,review_status,feedback,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200),
        db.from("library_books").select("id,title,subject,grade_level,school_grade_label,school_review_status,status,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200),
        db.from("school_operations_audit_events").select("id,entity_type,entity_id,action_type,before_state,after_state,created_at,actor_user_id").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      ]);
      if (requestId !== requestSequence.current) return;
      const [slotRes,eventRes,announcementRes,linkRes,notificationRes,behaviorRes,disciplineRes,contentRes,bookRes,auditRes] = queries;
      const critical = [slotRes,eventRes].find((result) => result.error)?.error;
      if (critical) throw new Error(critical.message || "Timetable and calendar could not be loaded.");
      setSlots((slotRes.data || []) as Slot[]);
      setEvents((eventRes.data || []) as EventRow[]);
      setAnnouncements(announcementRes.data || []);
      setParentLinks(linkRes.data || []);
      setParentNotifications(notificationRes.data || []);
      setBehaviorReports(behaviorRes.data || []);
      setDisciplineItems(disciplineRes.data || []);
      setContentReviews(contentRes.data || []);
      setSchoolBooks(bookRes.data || []);
      setAuditEvents(auditRes.data || []);
      const optionalErrors = [announcementRes,linkRes,notificationRes,behaviorRes,disciplineRes,contentRes,bookRes,auditRes].filter((result) => result.error);
      if (optionalErrors.length) setError("Some oversight panels are hidden by current role permissions. Timetable and calendar are available.");
    } catch (cause) {
      if (requestId === requestSequence.current) setError(cause instanceof Error ? cause.message : "School operations could not be loaded.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [db, schoolId]);

  useEffect(() => { void load(); return () => { requestSequence.current += 1; }; }, [load]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const sectionById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);
  const nameOf = (membershipId?: string | null) => {
    if (!membershipId) return "Unassigned";
    const member = memberById.get(membershipId);
    return (member && profiles[member.user_id]?.name) || member?.school_username || member?.student_number || "School member";
  };
  const visibleSlots = slots.filter((slot) => slot.active && (yearFilter === "all" || slot.academic_year_id === yearFilter) && (sectionFilter === "all" || slot.section_id === sectionFilter));
  const activeEvents = events.filter((event) => event.status === "scheduled");
  const activeLinks = parentLinks.filter((link) => link.status === "active");
  const unreadNotifications = parentNotifications.filter((item) => !item.read_at).length;
  const pendingBehavior = behaviorReports.filter((item) => item.status === "pending").length;
  const pendingDiscipline = disciplineItems.filter((item) => item.status === "pending").length;
  const pendingContent = schoolBooks.filter((book) => ["pending","submitted","in_review"].includes(String(book.school_review_status || "").toLowerCase())).length;

  const resetSlot = () => {
    setEditingSlot(null); setSlotYear(""); setSlotSection(""); setSlotTeacher(""); setSlotSubject("");
    setSlotDay("1"); setSlotStart("08:00"); setSlotEnd("08:45"); setSlotRoom(""); setSlotNotes("");
  };
  const editSlot = (slot: Slot) => {
    setEditingSlot(slot.id); setSlotYear(slot.academic_year_id); setSlotSection(slot.section_id);
    setSlotTeacher(slot.teacher_membership_id || ""); setSlotSubject(slot.subject_name); setSlotDay(String(slot.weekday));
    setSlotStart(timeOnly(slot.starts_at)); setSlotEnd(timeOnly(slot.ends_at)); setSlotRoom(slot.room_label || ""); setSlotNotes(slot.notes || "");
    setTab("timetable");
  };
  const saveSlot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !slotYear || !slotSection || !slotSubject.trim() || !slotStart || !slotEnd || slotEnd <= slotStart) {
      toast.error("Choose an academic year and section, enter a subject, and provide a valid time range."); return;
    }
    const payload = {
      school_id: schoolId, academic_year_id: slotYear, section_id: slotSection,
      teacher_membership_id: slotTeacher || null, subject_name: slotSubject.trim(),
      weekday: Number(slotDay), starts_at: slotStart, ends_at: slotEnd,
      room_label: slotRoom.trim() || null, notes: slotNotes.trim() || null,
      created_by_membership_id: members.find((member) => member.id === memberById.get(member.id)?.id && member.id === member.id)?.id,
    };
    const result = editingSlot
      ? await db.from("school_timetable_slots").update(payload).eq("id", editingSlot).eq("school_id", schoolId)
      : await db.from("school_timetable_slots").insert(payload);
    if (result.error) { toast.error(result.error.message || "Timetable entry could not be saved."); return; }
    toast.success(editingSlot ? "Timetable entry updated." : "Timetable entry created.");
    resetSlot(); await load();
  };
  const toggleSlot = async (slot: Slot) => {
    const { error: updateError } = await db.from("school_timetable_slots").update({ active: !slot.active }).eq("id", slot.id).eq("school_id", schoolId);
    if (updateError) { toast.error(updateError.message); return; }
    toast.success(slot.active ? "Timetable entry archived." : "Timetable entry restored."); await load();
  };
  const createEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || eventTitle.trim().length < 2 || !eventStart || !eventEnd || new Date(eventEnd) <= new Date(eventStart)) {
      toast.error("Enter an event title and a valid start and end date/time."); return;
    }
    if (eventAudience === "grade" && !eventGrade) { toast.error("Choose a grade for this event."); return; }
    if (eventAudience === "section" && (!eventGrade || !eventSection)) { toast.error("Choose a grade and section for this event."); return; }
    const creator = members.find((member) => member.id === (window as any).__schoolManagerMembershipId)?.id;
    const payload = {
      school_id: schoolId, academic_year_id: yearFilter === "all" ? null : yearFilter,
      title: eventTitle.trim(), description: eventDescription.trim() || null, event_type: eventType,
      audience_type: eventAudience, grade_label: ["grade","section"].includes(eventAudience) ? eventGrade : null,
      section_id: eventAudience === "section" ? eventSection : null,
      starts_at: new Date(eventStart).toISOString(), ends_at: new Date(eventEnd).toISOString(),
      all_day: eventAllDay, location: eventLocation.trim() || null, created_by_membership_id: creator,
    };
    const { error: insertError } = await db.from("school_calendar_events").insert(payload);
    if (insertError) { toast.error(insertError.message || "Calendar event could not be created."); return; }
    setEventTitle(""); setEventDescription(""); setEventStart(""); setEventEnd(""); setEventLocation("");
    toast.success("School calendar event created."); await load();
  };
  const cancelEvent = async (event: EventRow) => {
    const { error: updateError } = await db.from("school_calendar_events").update({ status: "cancelled" }).eq("id", event.id).eq("school_id", schoolId);
    if (updateError) { toast.error(updateError.message); return; }
    toast.success("Calendar event cancelled and audited."); await load();
  };

  const tabButton = (id: string, label: string) => (
    <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
      className={"rounded-lg px-3 py-2 text-sm font-medium " + (tab === id ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>{label}</button>
  );
  const memberLabel = (id?: string | null) => nameOf(id);
  const tabs = [
    ["timetable","Timetable"],["calendar","Calendar"],["announcements","Announcements"],
    ["families","Parent engagement"],["support","Student support"],["content","Content review"],["audit","Operations audit"],
  ];

  return <div className="space-y-5">
    <SchoolPageHeading title="School operations & community" description="Manage the school timetable and calendar, and oversee announcements, family engagement, student support, and learning-content review. Existing review permissions remain enforced." action={<SchoolSecondaryButton onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</SchoolSecondaryButton>} />
    {error && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SchoolMetric label="Active timetable slots" value={slots.filter((slot) => slot.active).length} detail="Recurring weekly lessons" icon={Clock3}/>
      <SchoolMetric label="Upcoming calendar events" value={activeEvents.length} detail="Scheduled school events" icon={CalendarDays}/>
      <SchoolMetric label="Active parent links" value={activeLinks.length} detail="Verified school relationships" icon={Users}/>
      <SchoolMetric label="Pending student support" value={pendingBehavior + pendingDiscipline} detail={pendingBehavior + " behavior · " + pendingDiscipline + " recommendations"} icon={ShieldAlert}/>
    </div>
    <div className="flex flex-wrap gap-2">{tabs.map(([id,label]) => tabButton(id,label))}</div>

    {tab === "timetable" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      <SchoolPanel title="Weekly timetable" description="Recurring lessons are scoped to an academic year and section. The database rejects section, teacher, and room overlaps.">
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <SchoolField label="Academic year"><select className={schoolSelectClass} value={yearFilter} onChange={(e)=>setYearFilter(e.target.value)}><option value="all">All years</option>{years.map((year)=><option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
          <SchoolField label="Section"><select className={schoolSelectClass} value={sectionFilter} onChange={(e)=>setSectionFilter(e.target.value)}><option value="all">All sections</option>{sections.filter((section)=>yearFilter==="all"||section.academic_year_id===yearFilter).map((section)=><option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
        </div>
        {visibleSlots.length ? <div className="space-y-3">{weekdays.map((day,index)=>{const daySlots=visibleSlots.filter((slot)=>slot.weekday===index+1); return daySlots.length ? <div key={day}><h3 className="mb-2 text-sm font-semibold text-slate-800">{day}</h3><div className="space-y-2">{daySlots.map((slot)=><div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div className="min-w-0"><p className="font-medium text-slate-900">{slot.subject_name}</p><p className="text-xs text-slate-500">{sectionById.get(slot.section_id)?.grade_label} {sectionById.get(slot.section_id)?.section_name} · {timeOnly(slot.starts_at)}–{timeOnly(slot.ends_at)}</p><p className="text-xs text-slate-500">{nameOf(slot.teacher_membership_id)} · {slot.room_label || "Room not set"}</p></div><div className="flex gap-2"><SchoolSecondaryButton onClick={()=>editSlot(slot)}>Edit</SchoolSecondaryButton><SchoolSecondaryButton onClick={()=>void toggleSlot(slot)}>{slot.active?"Archive":"Restore"}</SchoolSecondaryButton></div></div>)}</div></div>:null;})}</div> : <SchoolEmptyState title={loading?"Loading timetable":"No timetable entries"} description="Create the school's first real weekly timetable entry. No sample lessons are inserted."/>}
      </SchoolPanel>
      <SchoolPanel title={editingSlot?"Edit timetable entry":"Add timetable entry"} description="Teacher must already be assigned to the selected section and subject.">
        <form className="space-y-3" onSubmit={(e)=>void saveSlot(e)}>
          <SchoolField label="Academic year"><select className={schoolSelectClass} value={slotYear} onChange={(e)=>setSlotYear(e.target.value)} required><option value="">Select year</option>{years.map((year)=><option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
          <SchoolField label="Section"><select className={schoolSelectClass} value={slotSection} onChange={(e)=>setSlotSection(e.target.value)} required><option value="">Select section</option>{sections.filter((section)=>!slotYear||section.academic_year_id===slotYear).map((section)=><option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
          <SchoolField label="Subject"><input className={schoolInputClass} value={slotSubject} onChange={(e)=>setSlotSubject(e.target.value)} maxLength={120} required placeholder="Subject name"/></SchoolField>
          <SchoolField label="Assigned teacher (optional)"><select className={schoolSelectClass} value={slotTeacher} onChange={(e)=>setSlotTeacher(e.target.value)}><option value="">Not assigned</option>{members.filter((member)=>member.school_role==="teacher"&&member.status==="active").map((member)=><option key={member.id} value={member.id}>{nameOf(member.id)}</option>)}</select></SchoolField>
          <div className="grid grid-cols-3 gap-2">
            <SchoolField label="Day"><select className={schoolSelectClass} value={slotDay} onChange={(e)=>setSlotDay(e.target.value)}>{weekdays.map((day,index)=><option key={day} value={index+1}>{day.slice(0,3)}</option>)}</select></SchoolField>
            <SchoolField label="Start"><input type="time" className={schoolInputClass} value={slotStart} onChange={(e)=>setSlotStart(e.target.value)} required/></SchoolField>
            <SchoolField label="End"><input type="time" className={schoolInputClass} value={slotEnd} onChange={(e)=>setSlotEnd(e.target.value)} required/></SchoolField>
          </div>
          <SchoolField label="Room"><input className={schoolInputClass} value={slotRoom} onChange={(e)=>setSlotRoom(e.target.value)} maxLength={80} placeholder="Room / lab"/></SchoolField>
          <SchoolField label="Notes"><textarea className={schoolTextareaClass} value={slotNotes} onChange={(e)=>setSlotNotes(e.target.value)} maxLength={1000} rows={2}/></SchoolField>
          <div className="flex gap-2"><SchoolPrimaryButton type="submit">{editingSlot?"Save changes":"Add timetable slot"}</SchoolPrimaryButton>{editingSlot&&<SchoolSecondaryButton type="button" onClick={resetSlot}>Cancel</SchoolSecondaryButton>}</div>
        </form>
      </SchoolPanel>
    </div>}

    {tab === "calendar" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      <SchoolPanel title="School calendar" description="Events, exams, holidays, meetings, and deadlines. Cancelled events remain visible for the audit trail.">
        {events.length?<div className="space-y-2">{events.map((event)=><div key={event.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-900">{event.title}</p><SchoolStatus value={event.status}/><span className="text-xs text-slate-500">{event.event_type.replace(/_/g," ")}</span></div><p className="mt-1 text-xs text-slate-600">{dateTime(event.starts_at)} – {dateTime(event.ends_at)}</p><p className="text-xs text-slate-500">{event.audience_type==="section"?"Section "+(sectionById.get(event.section_id||"")?.section_name||""):event.audience_type==="grade"?event.grade_label:event.audience_type} · {event.location||"Location not set"}</p>{event.description&&<p className="mt-2 text-sm text-slate-600">{event.description}</p>}</div>{event.status==="scheduled"&&<SchoolSecondaryButton onClick={()=>void cancelEvent(event)}>Cancel event</SchoolSecondaryButton>}</div>)}</div>:<SchoolEmptyState title="No calendar events" description="Create an event to begin the school's calendar. No example events are preloaded."/>}
      </SchoolPanel>
      <SchoolPanel title="Create calendar event" description="Audience targeting is stored with the event; it does not automatically send a notification.">
        <form className="space-y-3" onSubmit={(e)=>void createEvent(e)}>
          <SchoolField label="Title"><input className={schoolInputClass} value={eventTitle} onChange={(e)=>setEventTitle(e.target.value)} maxLength={180} required/></SchoolField>
          <SchoolField label="Type"><select className={schoolSelectClass} value={eventType} onChange={(e)=>setEventType(e.target.value)}><option value="school_event">School event</option><option value="exam">Exam</option><option value="holiday">Holiday</option><option value="meeting">Meeting</option><option value="deadline">Deadline</option><option value="other">Other</option></select></SchoolField>
          <SchoolField label="Audience"><select className={schoolSelectClass} value={eventAudience} onChange={(e)=>setEventAudience(e.target.value)}><option value="school">Whole school</option><option value="staff">Staff</option><option value="parents">Parents</option><option value="students">Students</option><option value="grade">Specific grade</option><option value="section">Specific section</option></select></SchoolField>
          {["grade","section"].includes(eventAudience)&&<SchoolField label="Grade"><select className={schoolSelectClass} value={eventGrade} onChange={(e)=>{setEventGrade(e.target.value);setEventSection("");}}><option value="">Select grade</option>{[...new Set(sections.map((section)=>section.grade_label))].filter(Boolean).map((grade)=><option key={grade} value={grade}>{grade}</option>)}</select></SchoolField>}
          {eventAudience==="section"&&<SchoolField label="Section"><select className={schoolSelectClass} value={eventSection} onChange={(e)=>setEventSection(e.target.value)}><option value="">Select section</option>{sections.filter((section)=>section.grade_label===eventGrade).map((section)=><option key={section.id} value={section.id}>{section.section_name}</option>)}</select></SchoolField>}
          <div className="grid gap-3 sm:grid-cols-2"><SchoolField label="Starts"><input type="datetime-local" className={schoolInputClass} value={eventStart} onChange={(e)=>setEventStart(e.target.value)} required/></SchoolField><SchoolField label="Ends"><input type="datetime-local" className={schoolInputClass} value={eventEnd} onChange={(e)=>setEventEnd(e.target.value)} required/></SchoolField></div>
          <SchoolField label="Location"><input className={schoolInputClass} value={eventLocation} onChange={(e)=>setEventLocation(e.target.value)} maxLength={180}/></SchoolField>
          <SchoolField label="Description"><textarea className={schoolTextareaClass} value={eventDescription} onChange={(e)=>setEventDescription(e.target.value)} rows={3} maxLength={5000}/></SchoolField>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={eventAllDay} onChange={(e)=>setEventAllDay(e.target.checked)}/>All-day event</label>
          <SchoolPrimaryButton type="submit">Create event</SchoolPrimaryButton>
        </form>
      </SchoolPanel>
    </div>}

    {tab === "announcements" && <SchoolPanel title="Announcement oversight" description="This view respects the existing author and academic-leadership approval workflow. The Manager can monitor but cannot bypass publication permissions.">
      {announcements.length?<div className="space-y-2">{announcements.map((item)=><div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-slate-900">{item.title}</p><SchoolStatus value={item.status}/></div><p className="mt-1 text-xs text-slate-500">{item.audience_type} · {dateOnly(item.created_at)}{item.published_at?" · Published "+dateOnly(item.published_at):""}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>{item.review_feedback&&<p className="mt-2 text-xs text-amber-800">Review note: {item.review_feedback}</p>}</div>)}</div>:<SchoolEmptyState title="No announcements visible" description="Announcements appear here when current school visibility rules allow the Manager to view them."/>}
    </SchoolPanel>}

    {tab === "families" && <div className="grid gap-4 xl:grid-cols-2">
      <SchoolPanel title="Parent–student connections" description="Relationship and access oversight only; private parent messages are not exposed in this workspace.">
        {parentLinks.length?<div className="max-h-[600px] space-y-2 overflow-y-auto">{parentLinks.map((link)=><div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-medium text-slate-900">{nameOf(link.parent_membership_id)} → {nameOf(link.student_membership_id)}</p><p className="text-xs text-slate-500">Linked {dateOnly(link.linked_at)}{link.ended_at?" · Ended "+dateOnly(link.ended_at):""}</p></div><SchoolStatus value={link.status}/></div>)}</div>:<SchoolEmptyState title="No parent links visible" description="Verified school parent–student links will appear when accessible."/>}
      </SchoolPanel>
      <SchoolPanel title="Parent notifications" description="Delivery records and unread counts where the current Manager permissions permit visibility.">
        <div className="mb-3 grid grid-cols-2 gap-3"><SchoolMetric label="Visible notifications" value={parentNotifications.length} icon={Megaphone}/><SchoolMetric label="Unread" value={unreadNotifications} icon={Clock3}/></div>
        {parentNotifications.length?<div className="max-h-[500px] space-y-2 overflow-y-auto">{parentNotifications.map((item)=><div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{item.title}</p><SchoolStatus value={item.read_at?"read":"unread"}/></div><p className="text-xs text-slate-500">{nameOf(item.parent_membership_id)} · {dateTime(item.created_at)}</p></div>)}</div>:<SchoolEmptyState title="No notification records visible" description="Private notifications remain protected by recipient-level access controls."/>}
      </SchoolPanel>
    </div>}

    {tab === "support" && <div className="grid gap-4 xl:grid-cols-2">
      <SchoolPanel title="Student behavior reports" description="Review queue visibility only. Decisions remain with authorized appointed leaders and the existing guarded review RPC.">
        <div className="mb-3 grid grid-cols-2 gap-3"><SchoolMetric label="Reports" value={behaviorReports.length} icon={ShieldAlert}/><SchoolMetric label="Pending" value={pendingBehavior} icon={Clock3}/></div>
        {behaviorReports.length?<div className="max-h-[600px] space-y-2 overflow-y-auto">{behaviorReports.map((item)=><div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{nameOf(item.student_membership_id)}</p><SchoolStatus value={item.status}/></div><p className="text-xs text-slate-500">{item.report_type} · {item.severity} · {dateTime(item.created_at)}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.description}</p>{item.review_note&&<p className="mt-1 text-xs text-slate-500">Review note: {item.review_note}</p>}</div>)}</div>:<SchoolEmptyState title="No behavior reports visible" description="Teacher-submitted reports appear when the Manager's school permissions allow access."/>}
      </SchoolPanel>
      <SchoolPanel title="Disciplinary recommendations" description="Recommendations are monitored here; no disciplinary outcome is applied by this read-only view.">
        <div className="mb-3 grid grid-cols-2 gap-3"><SchoolMetric label="Recommendations" value={disciplineItems.length} icon={ShieldAlert}/><SchoolMetric label="Pending" value={pendingDiscipline} icon={Clock3}/></div>
        {disciplineItems.length?<div className="max-h-[600px] space-y-2 overflow-y-auto">{disciplineItems.map((item)=><div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{nameOf(item.target_membership_id)} · {item.target_kind}</p><SchoolStatus value={item.status}/></div><p className="mt-1 text-xs text-slate-500">{dateTime(item.created_at)}</p><p className="mt-2 text-sm text-slate-700">{item.reason}</p><p className="mt-1 text-xs text-slate-500">Recommendation: {item.recommendation}</p>{item.decision_note&&<p className="mt-1 text-xs text-slate-500">Decision: {item.decision_note}</p>}</div>)}</div>:<SchoolEmptyState title="No recommendations visible" description="Recommendations are shown only within the current role's authorized scope."/>}
      </SchoolPanel>
    </div>}

    {tab === "content" && <div className="grid gap-4 xl:grid-cols-2">
      <SchoolPanel title="School library review status" description="Book ownership and approval remain governed by the existing school library workflow.">
        <div className="mb-3 grid grid-cols-2 gap-3"><SchoolMetric label="School books visible" value={schoolBooks.length} icon={BookOpen}/><SchoolMetric label="Pending review" value={pendingContent} icon={Clock3}/></div>
        {schoolBooks.length?<div className="max-h-[600px] space-y-2 overflow-y-auto">{schoolBooks.map((book)=><div key={book.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{book.title}</p><SchoolStatus value={book.school_review_status||book.status}/></div><p className="text-xs text-slate-500">{book.subject} · {book.school_grade_label||("Grade "+(book.grade_level??"—"))} · {dateOnly(book.created_at)}</p></div>)}</div>:<SchoolEmptyState title="No school books visible" description="School-owned library resources appear when the Manager can access them."/>}
      </SchoolPanel>
      <SchoolPanel title="Content review history" description="Immutable review events are displayed as history; this panel does not approve or reject content.">
        {contentReviews.length?<div className="max-h-[600px] space-y-2 overflow-y-auto">{contentReviews.map((item)=><div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item.content_type.replace(/_/g," ")}</p><SchoolStatus value={item.review_status}/></div><p className="text-xs text-slate-500">Submitted by {nameOf(item.submitted_by_membership_id)} · Reviewed by {nameOf(item.reviewed_by_membership_id)} · {dateTime(item.created_at)}</p>{item.feedback&&<p className="mt-2 text-sm text-slate-700">{item.feedback}</p>}</div>)}</div>:<SchoolEmptyState title="No content review events visible" description="Review events appear after authorized content decisions."/>}
      </SchoolPanel>
    </div>}

    {tab === "audit" && <SchoolPanel title="Timetable and calendar audit" description="Schedule and event changes are recorded by database triggers, including before/after snapshots.">
      {auditEvents.length?<div className="max-h-[700px] space-y-2 overflow-y-auto">{auditEvents.map((item)=><div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium capitalize">{item.action_type} · {item.entity_type.replace(/_/g," ")}</p><span className="text-xs text-slate-500">{dateTime(item.created_at)}</span></div><p className="mt-1 text-xs text-slate-500">Record {item.entity_id} · {item.actor_user_id||"System"}</p><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-xs text-slate-600">{JSON.stringify(item.after_state||item.before_state,null,2)}</pre></div>)}</div>:<SchoolEmptyState title="No timetable or calendar changes yet" description="Every create, update, archive, or cancellation will be recorded here."/>}
    </SchoolPanel>}
  </div>;
}
