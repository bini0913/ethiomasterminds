import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, GraduationCap, ClipboardList, CalendarCheck, ShieldCheck,
  Library, BookOpen, Megaphone, MessageSquare, Send, RefreshCw, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField,
  schoolInputClass, schoolTextareaClass, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";
import { getPdfPublicUrl } from "@/lib/libraryApi";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "results", label: "My Results", icon: GraduationCap },
  { id: "homework", label: "Homework", icon: ClipboardList },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "behavior", label: "Behavior", icon: ShieldCheck },
  { id: "library", label: "Textbooks & Library", icon: Library },
  { id: "quizzes", label: "School Quizzes", icon: BookOpen },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "messages", label: "Messages", icon: MessageSquare },
];

export default function SchoolStudentPortal() {
  const { activeSchool, activeMembership } = useSchoolPortal();
  const db = supabase as any;
  const schoolId = activeSchool?.id;
  const studentId = activeMembership?.id;
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [behaviorReports, setBehaviorReports] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [bookUrls, setBookUrls] = useState<Record<string, string>>({});
  const [quizzes, setQuizzes] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all((books || []).map(async (book) => {
        try {
          return [String(book.id), await getPdfPublicUrl(String(book.pdf_path || ""))] as const;
        } catch {
          return [String(book.id), ""] as const;
        }
      }));
      if (!cancelled) setBookUrls(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [books]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [newContactId, setNewContactId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [homeworkDrafts, setHomeworkDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!schoolId || !studentId) return;
    setLoading(true);
    const [
      profileRes, resultsRes, termsRes, attendanceRes, behaviorRes,
      homeworkRes, submissionsRes, booksRes, quizzesRes, announcementsRes, conversationsRes,
    ] = await Promise.all([
      db.from("profiles").select("id,name,username,grade,age").eq("id", activeMembership?.user_id).maybeSingle(),
      db.from("school_term_results").select("id,term_id,subject_name,average_score,letter_grade,rank_position,status,published_at").eq("school_id", schoolId).eq("student_membership_id", studentId).eq("status", "published").order("published_at", { ascending: false }),
      db.from("school_terms").select("id,name,term_number").eq("school_id", schoolId).order("term_number"),
      db.from("school_attendance_records").select("id,session_id,attendance_status,note,created_at").eq("school_id", schoolId).eq("student_membership_id", studentId).order("created_at", { ascending: false }).limit(300),
      db.from("school_behavior_reports").select("id,report_type,severity,description,review_note,reviewed_at,created_at,status").eq("school_id", schoolId).eq("student_membership_id", studentId).eq("status", "approved").order("reviewed_at", { ascending: false }),
      db.from("school_homework_assignments").select("id,title,subject_name,instructions,due_at,status,created_at").eq("school_id", schoolId).eq("section_id", activeMembership?.section_id).eq("status", "approved").order("due_at", { ascending: true }),
      db.from("school_homework_submissions").select("id,homework_id,response_text,status,grade,feedback,submitted_at").eq("school_id", schoolId).eq("student_membership_id", studentId),
      db.from("library_books").select("id,title,author,subject,description,pdf_path,school_review_status,status").eq("school_id", schoolId).eq("school_section_id", activeMembership?.section_id).eq("school_review_status", "approved").eq("status", "approved").order("created_at", { ascending: false }),
      db.from("quizzes").select("id,title,description,subject,difficulty,time_limit,school_review_status,is_approved").eq("school_id", schoolId).eq("school_section_id", activeMembership?.section_id).eq("school_review_status", "approved").eq("is_approved", true).order("created_at", { ascending: false }),
      db.from("school_announcements").select("id,title,body,audience_type,created_at,status").eq("school_id", schoolId).eq("status", "published").order("created_at", { ascending: false }).limit(100),
      db.from("school_conversations").select("id,conversation_type,section_id,student_membership_id,subject_name,last_message_at").eq("school_id", schoolId).order("last_message_at", { ascending: false }).limit(100),
    ]);
    const error = [profileRes, resultsRes, termsRes, attendanceRes, behaviorRes, homeworkRes, submissionsRes, booksRes, quizzesRes, announcementsRes, conversationsRes].find((result) => result.error)?.error;
    if (error) {
      toast.error(error.message || "School student records could not be loaded.");
      setLoading(false);
      return;
    }
    setProfile(profileRes.data);
    setResults(resultsRes.data ?? []);
    setTerms(termsRes.data ?? []);
    setAttendanceRecords(attendanceRes.data ?? []);
    setBehaviorReports(behaviorRes.data ?? []);
    setHomework(homeworkRes.data ?? []);
    setSubmissions(submissionsRes.data ?? []);
    setBooks(booksRes.data ?? []);
    setQuizzes(quizzesRes.data ?? []);
    setAnnouncements(announcementsRes.data ?? []);
    setConversations(conversationsRes.data ?? []);

    const sessionIds = [...new Set((attendanceRes.data ?? []).map((record: any) => record.session_id))];
    if (sessionIds.length) {
      const { data: sessionRows, error: sessionError } = await db.from("school_attendance_sessions").select("id,attendance_date,section_id,status").eq("school_id", schoolId).in("id", sessionIds);
      if (sessionError) toast.error(sessionError.message);
      setAttendanceSessions(sessionRows ?? []);
    } else setAttendanceSessions([]);

    const { data: contactRows, error: contactsError } = await db.rpc("school_student_school_contacts");
    if (contactsError) toast.error(contactsError.message);
    setContacts(contactRows ?? []);
    setLoading(false);
  }, [schoolId, studentId, activeMembership?.user_id, activeMembership?.section_id, db]);

  useEffect(() => { void load(); }, [load]);

  const studentName = profile?.name || activeMembership?.school_username || "Student";
  const termName = (termId: string) => terms.find((term) => term.id === termId)?.name || "Term";
  const unreadHomework = homework.filter((item) => !submissions.some((submission) => submission.homework_id === item.id && ["submitted", "graded"].includes(submission.status))).length;
  const memberName = (membershipId: string) => contacts.find((contact) => contact.contact_membership_id === membershipId)?.contact_name || (membershipId === studentId ? studentName : "School contact");

  const submitHomework = async (item: any) => {
    const response = homeworkDrafts[item.id] ?? submissions.find((submission) => submission.homework_id === item.id)?.response_text ?? "";
    if (!response.trim()) return toast.error("Write your homework response before submitting.");
    const existing = submissions.find((submission) => submission.homework_id === item.id);
    const payload = {
      school_id: schoolId, homework_id: item.id, student_membership_id: studentId,
      response_text: response.trim(), status: "submitted", submitted_at: new Date().toISOString(),
    };
    const query = existing
      ? db.from("school_homework_submissions").update({ response_text: payload.response_text, status: "submitted", submitted_at: payload.submitted_at }).eq("id", existing.id)
      : db.from("school_homework_submissions").insert(payload);
    const { error } = await query;
    if (error) return toast.error(error.message);
    toast.success("Homework submitted to your teacher.");
    await load();
  };

  const createConversation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newContactId) return toast.error("Choose a teacher or School Manager.");
    const { data, error } = await db.rpc("school_create_conversation", {
      p_school_id: schoolId,
      p_conversation_type: "direct",
      p_student_membership_id: studentId,
      p_participant_membership_ids: [studentId, newContactId],
      p_subject_name: null,
    });
    if (error) return toast.error(error.message);
    setSelectedConversationId(data);
    setNewContactId("");
    toast.success("Conversation created.");
    await load();
  };

  useEffect(() => {
    if (!selectedConversationId || !schoolId) { setMessages([]); return; }
    let cancelled = false;
    const fetchMessages = async () => {
      const { data, error } = await db.from("school_messages").select("id,body,sender_membership_id,created_at").eq("school_id", schoolId).eq("conversation_id", selectedConversationId).order("created_at", { ascending: true });
      if (!cancelled) {
        if (error) toast.error(error.message);
        else setMessages(data ?? []);
      }
    };
    void fetchMessages();
    return () => { cancelled = true; };
  }, [selectedConversationId, schoolId, db]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedConversationId || !messageDraft.trim()) return;
    const { error } = await db.from("school_messages").insert({
      school_id: schoolId, conversation_id: selectedConversationId,
      sender_membership_id: studentId, body: messageDraft.trim(),
    });
    if (error) return toast.error(error.message);
    setMessageDraft("");
    const { data } = await db.from("school_messages").select("id,body,sender_membership_id,created_at").eq("school_id", schoolId).eq("conversation_id", selectedConversationId).order("created_at", { ascending: true });
    setMessages(data ?? []);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <SchoolPageHeading title={`Hello, ${studentName}`} description={`${activeMembership?.grade_label || "School student"} · ${activeSchool?.name || "School workspace"}`} action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Published subject results" value={results.length} detail="Official school results" icon={GraduationCap} />
        <SchoolMetric label="Homework to complete" value={unreadHomework} detail="Approved assignments" icon={ClipboardList} />
        <SchoolMetric label="Attendance records" value={attendanceRecords.length} detail="Your school attendance history" icon={CalendarCheck} />
        <SchoolMetric label="Learning resources" value={books.length} detail="Approved class resources" icon={Library} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Latest announcements">
          {announcements.length ? <div className="divide-y divide-slate-100">{announcements.slice(0, 5).map((item) => <div key={item.id} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-600">{item.body}</p><p className="mt-1 text-[11px] text-slate-500">{new Date(item.created_at).toLocaleDateString()}</p></div>)}</div> : <SchoolEmptyState title="No announcements" description="School announcements will appear here." />}
        </SchoolPanel>
        <SchoolPanel title="Next steps">
          <div className="space-y-2"><button onClick={() => setPage("homework")} className="w-full rounded-md border border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">Review homework and assignments</button><button onClick={() => setPage("results")} className="w-full rounded-md border border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">Check published results</button><button onClick={() => setPage("library")} className="w-full rounded-md border border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">Open class learning resources</button></div>
        </SchoolPanel>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="My academic results" description="Only official results published by an authorized academic leader appear here." />
      {results.length ? <SchoolPanel title="Published report card"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Term</th><th className="pb-2">Subject</th><th className="pb-2">Average</th><th className="pb-2">Letter grade</th><th className="pb-2">Rank</th></tr></thead><tbody className="divide-y divide-slate-100">{results.map((result) => <tr key={result.id}><td className="py-3 text-slate-600">{termName(result.term_id)}</td><td className="py-3 font-medium text-slate-800">{result.subject_name}</td><td className="py-3 tabular-nums text-slate-700">{result.average_score ?? "—"}</td><td className="py-3 text-slate-600">{result.letter_grade || "—"}</td><td className="py-3 tabular-nums text-slate-600">{result.rank_position ?? "—"}</td></tr>)}</tbody></table></div></SchoolPanel> : <SchoolEmptyState title="No results published yet" description="Your official averages and ranks will appear after the School Manager publishes them." />}
    </div>
  );

  const renderHomework = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Homework & assignments" description="Read approved assignments and submit your work to the teacher." />
      {homework.length ? <div className="space-y-3">{homework.map((item) => { const submission = submissions.find((row) => row.homework_id === item.id); return <SchoolPanel key={item.id} title={item.title} description={`${item.subject_name} · Due ${item.due_at ? new Date(item.due_at).toLocaleString() : "No due date"}`}><p className="whitespace-pre-wrap text-sm text-slate-700">{item.instructions}</p><div className="mt-3"><SchoolStatus value={submission?.status || "not_submitted"} /></div><SchoolField label="Your response"><textarea className={schoolTextareaClass} rows={4} disabled={submission?.status === "graded"} value={homeworkDrafts[item.id] ?? submission?.response_text ?? ""} onChange={(event) => setHomeworkDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Write your homework response…" /></SchoolField><div className="mt-3 flex flex-wrap items-center justify-between gap-2">{submission?.feedback && <p className="text-xs text-slate-600">Teacher feedback: {submission.feedback}</p>}{submission?.grade !== null && submission?.grade !== undefined && <p className="text-xs font-semibold text-slate-700">Grade: {submission.grade}</p>}<SchoolPrimaryButton onClick={() => void submitHomework(item)} disabled={submission?.status === "graded"}>{submission?.status === "graded" ? "Already graded" : "Submit homework"}</SchoolPrimaryButton></div></SchoolPanel>; })}</div> : <SchoolEmptyState title="No homework assigned" description="Approved homework from your teachers will appear here." />}
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="My attendance" description="Daily attendance recorded by your homeroom teacher." />
      {attendanceRecords.length ? <SchoolPanel title="Attendance history"><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Date</th><th className="pb-2">Attendance</th><th className="pb-2">Note</th></tr></thead><tbody className="divide-y divide-slate-100">{attendanceRecords.map((record) => <tr key={record.id}><td className="py-3 text-slate-600">{attendanceSessions.find((session) => session.id === record.session_id)?.attendance_date || new Date(record.created_at).toLocaleDateString()}</td><td className="py-3"><SchoolStatus value={record.attendance_status} /></td><td className="py-3 text-slate-600">{record.note || "—"}</td></tr>)}</tbody></table></div></SchoolPanel> : <SchoolEmptyState title="No attendance history" description="Your homeroom teacher's daily records will appear here." />}
    </div>
  );

  const renderBehavior = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="My behavior record" description="Reviewed and approved reports from your teachers and homeroom teacher." />
      {behaviorReports.length > 0 ? (
        <SchoolPanel title="Approved reports">
          <div className="space-y-3">
            {behaviorReports.map((report) => (
              <div key={report.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold capitalize text-slate-800">{report.report_type.replace(/_/g, " ")}</p>
                  <SchoolStatus value={report.severity} />
                </div>
                <p className="mt-2 text-sm text-slate-700">{report.description}</p>
                {report.review_note && <p className="mt-2 text-xs text-slate-600">School note: {report.review_note}</p>}
              </div>
            ))}
          </div>
        </SchoolPanel>
      ) : (
        <SchoolEmptyState title="No approved behavior reports" description="Reviewed reports will appear here." />
      )}
    </div>
  );

  const renderLibrary = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Textbooks & digital library" description="School-approved textbooks, notes, and learning resources for your section." />
      {books.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{books.map((book) => <SchoolPanel key={book.id} title={book.title} description={`${book.subject} · ${book.author || "School resource"}`}><p className="line-clamp-3 text-sm text-slate-600">{book.description}</p>{bookUrls[String(book.id)] ? <a href={bookUrls[String(book.id)]} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-sm font-semibold text-blue-700 hover:underline"><FileText className="mr-2 h-4 w-4" />Open PDF</a> : <p className="mt-3 text-sm text-slate-500">PDF unavailable. Please retry later.</p>}</SchoolPanel>)}</div> : <SchoolEmptyState title="No approved resources yet" description="Your teacher's approved textbooks and notes will appear here." />}
    </div>
  );

  const renderQuizzes = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School quizzes" description="Quizzes approved by an authorized academic leader for your section." />
      {quizzes.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{quizzes.map((quiz) => <SchoolPanel key={quiz.id} title={quiz.title} description={`${quiz.subject} · ${quiz.difficulty}`}><p className="text-sm text-slate-600">{quiz.description}</p><p className="mt-2 text-xs text-slate-500">{quiz.time_limit} minute time limit</p><SchoolStatus value="approved" /></SchoolPanel>)}</div> : <SchoolEmptyState title="No approved quizzes" description="Your teachers' quizzes will appear after academic leadership approval." />}
    </div>
  );

  const renderAnnouncements = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School announcements" description="Updates shared with your school, grade, or class." />
      {announcements.length ? <div className="space-y-3">{announcements.map((item) => <SchoolPanel key={item.id} title={item.title} description={new Date(item.created_at).toLocaleString()}><p className="whitespace-pre-wrap text-sm text-slate-700">{item.body}</p></SchoolPanel>)}</div> : <SchoolEmptyState title="No announcements" description="School announcements will appear here." />}
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Messages" description="Contact teachers assigned to your class or your School Manager." />
      <SchoolPanel title="Start a conversation">
        <form onSubmit={createConversation} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full max-w-sm"><SchoolField label="Teacher or School Manager"><select className={schoolSelectClass} value={newContactId} onChange={(event) => setNewContactId(event.target.value)}><option value="">Choose contact</option>{contacts.map((contact) => <option key={contact.contact_membership_id} value={contact.contact_membership_id}>{contact.contact_name} · {contact.contact_role}{contact.subject_name ? ` · ${contact.subject_name}` : ""}</option>)}</select></SchoolField></div>
          <SchoolPrimaryButton type="submit">Start conversation</SchoolPrimaryButton>
        </form>
      </SchoolPanel>
      <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
        <SchoolPanel title="Conversations">{conversations.length ? <div className="space-y-1">{conversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={["w-full rounded-md border px-3 py-2.5 text-left", selectedConversationId === conversation.id ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-slate-50"].join(" ")}><p className="text-sm font-medium text-slate-800">{conversation.conversation_type === "class" ? "Class conversation" : "Direct conversation"}</p><p className="mt-1 text-xs text-slate-500">{conversation.subject_name || "School message"}</p></button>)}</div> : <SchoolEmptyState title="No conversations" description="Start a conversation with an assigned teacher." />}</SchoolPanel>
        <SchoolPanel title="Messages">{selectedConversationId ? <><div className="max-h-[420px] space-y-3 overflow-y-auto">{messages.map((message) => <div key={message.id} className={["max-w-[85%] rounded-lg px-3 py-2 text-sm", message.sender_membership_id === studentId ? "ml-auto bg-blue-600 text-white" : "bg-slate-100 text-slate-800"].join(" ")}><p>{message.body}</p><p className="mt-1 text-[10px] opacity-70">{memberName(message.sender_membership_id)} · {new Date(message.created_at).toLocaleString()}</p></div>)}</div><form onSubmit={sendMessage} className="mt-4 flex gap-2"><input className={schoolInputClass} value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Write a message…" /><SchoolPrimaryButton type="submit"><Send className="h-4 w-4" /></SchoolPrimaryButton></form></> : <SchoolEmptyState title="Select a conversation" description="Choose a conversation to read and reply." />}</SchoolPanel>
      </div>
    </div>
  );

  let content: React.ReactNode;
  switch (page) {
    case "results": content = renderResults(); break;
    case "homework": content = renderHomework(); break;
    case "attendance": content = renderAttendance(); break;
    case "behavior": content = renderBehavior(); break;
    case "library": content = renderLibrary(); break;
    case "quizzes": content = renderQuizzes(); break;
    case "announcements": content = renderAnnouncements(); break;
    case "messages": content = renderMessages(); break;
    default: content = renderOverview();
  }

  return (
    <SchoolPortalShell role="student" title="School Student Portal" navItems={navItems} activeItem={page} onNavigate={setPage}>
      {loading && <div className="mb-4 text-xs text-slate-500">Refreshing your school records…</div>}
      {content}
    </SchoolPortalShell>
  );
}
