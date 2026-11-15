import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Users, GraduationCap, CalendarCheck, ShieldCheck,
  ClipboardList, Wallet, MessageSquare, Bell, RefreshCw, Send, Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField,
  schoolInputClass, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "children", label: "My Children", icon: Users },
  { id: "results", label: "Academic Results", icon: GraduationCap },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "behavior", label: "Behavior Reports", icon: ShieldCheck },
  { id: "homework", label: "Homework", icon: ClipboardList },
  { id: "fees", label: "School Fees", icon: Wallet },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export default function SchoolParentPortal() {
  const { activeSchool, activeMembership } = useSchoolPortal();
  const db = supabase as any;
  const schoolId = activeSchool?.id;
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [selectedChildId, setSelectedChildId] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [behaviorReports, setBehaviorReports] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [homeworkSubmissions, setHomeworkSubmissions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [newTeacherId, setNewTeacherId] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const load = useCallback(async () => {
    if (!schoolId || !activeMembership?.id) return;
    setLoading(true);
    const { data: links, error: linksError } = await db.from("school_parent_student_links")
      .select("student_membership_id,status")
      .eq("school_id", schoolId)
      .eq("parent_membership_id", activeMembership.id)
      .eq("status", "active");
    if (linksError) {
      toast.error(linksError.message);
      setLoading(false);
      return;
    }
    const studentIds = [...new Set((links ?? []).map((link: any) => link.student_membership_id))];
    if (!studentIds.length) {
      setChildren([]); setResults([]); setAttendanceRecords([]); setAttendanceSessions([]);
      setBehaviorReports([]); setHomework([]); setHomeworkSubmissions([]); setInvoices([]);
      setPayments([]); setNotifications([]); setAnnouncements([]); setConversations([]);
      setLoading(false);
      return;
    }

    const [
      childrenRes, resultsRes, attendanceRes, behaviorRes, homeworkRes,
      submissionsRes, invoicesRes, notificationsRes, announcementsRes, conversationsRes,
    ] = await Promise.all([
      db.from("school_memberships").select("id,user_id,school_role,status,grade_label,section_id,student_number,school_username").eq("school_id", schoolId).in("id", studentIds),
      db.from("school_term_results").select("id,term_id,student_membership_id,section_id,grade_label,subject_name,average_score,letter_grade,rank_position,status,published_at").eq("school_id", schoolId).in("student_membership_id", studentIds).eq("status", "published").order("published_at", { ascending: false }),
      db.from("school_attendance_records").select("id,session_id,student_membership_id,attendance_status,note,created_at").eq("school_id", schoolId).in("student_membership_id", studentIds).order("created_at", { ascending: false }).limit(300),
      db.from("school_behavior_reports").select("id,student_membership_id,report_type,severity,description,review_note,reviewed_at,created_at,status").eq("school_id", schoolId).in("student_membership_id", studentIds).eq("status", "approved").order("reviewed_at", { ascending: false }).limit(100),
      db.from("school_homework_assignments").select("id,title,section_id,subject_name,instructions,due_at,status,created_at").eq("school_id", schoolId).eq("status", "approved").order("due_at", { ascending: true }),
      db.from("school_homework_submissions").select("id,homework_id,student_membership_id,status,grade,feedback,submitted_at").eq("school_id", schoolId).in("student_membership_id", studentIds),
      db.from("school_student_invoices").select("id,invoice_number,student_membership_id,description,amount,paid_amount,balance,currency,due_date,status").eq("school_id", schoolId).in("student_membership_id", studentIds).order("created_at", { ascending: false }),
      db.from("school_parent_notifications").select("id,student_membership_id,notification_type,title,message,read_at,created_at").eq("school_id", schoolId).eq("parent_membership_id", activeMembership.id).order("created_at", { ascending: false }).limit(100),
      db.from("school_announcements").select("id,title,body,audience_type,grade_label,section_id,created_at,status").eq("school_id", schoolId).eq("status", "published").order("created_at", { ascending: false }).limit(100),
      db.from("school_conversations").select("id,conversation_type,section_id,student_membership_id,subject_name,last_message_at").eq("school_id", schoolId).order("last_message_at", { ascending: false }).limit(100),
    ]);

    const firstError = [childrenRes, resultsRes, attendanceRes, behaviorRes, homeworkRes, submissionsRes, invoicesRes, notificationsRes, announcementsRes, conversationsRes].find((result) => result.error)?.error;
    if (firstError) {
      toast.error(firstError.message || "Parent records could not be loaded.");
      setLoading(false);
      return;
    }
    setChildren(childrenRes.data ?? []);
    setResults(resultsRes.data ?? []);
    setAttendanceRecords(attendanceRes.data ?? []);
    setBehaviorReports(behaviorRes.data ?? []);
    setHomework(homeworkRes.data ?? []);
    setHomeworkSubmissions(submissionsRes.data ?? []);
    setInvoices(invoicesRes.data ?? []);
    setNotifications(notificationsRes.data ?? []);
    setAnnouncements(announcementsRes.data ?? []);
    setConversations(conversationsRes.data ?? []);
    if (!selectedChildId || !studentIds.includes(selectedChildId)) setSelectedChildId(studentIds[0]);

    const { data: termRows, error: termError } = await db.from("school_terms").select("id,name,term_number").eq("school_id", schoolId);
    if (termError) toast.error(termError.message);
    setTerms(termRows ?? []);

    const sessionIds = [...new Set((attendanceRes.data ?? []).map((record: any) => record.session_id))];
    if (sessionIds.length) {
      const { data: sessionRows, error: sessionError } = await db.from("school_attendance_sessions").select("id,attendance_date,section_id,status").eq("school_id", schoolId).in("id", sessionIds);
      if (sessionError) toast.error(sessionError.message);
      setAttendanceSessions(sessionRows ?? []);
    } else setAttendanceSessions([]);

    const invoiceIds = (invoicesRes.data ?? []).map((invoice: any) => invoice.id);
    if (invoiceIds.length) {
      const { data: paymentRows, error: paymentError } = await db.from("school_fee_payments").select("id,invoice_id,amount,payment_method,reference,receipt_number,status,received_at").eq("school_id", schoolId).in("invoice_id", invoiceIds).order("received_at", { ascending: false });
      if (paymentError) toast.error(paymentError.message);
      setPayments(paymentRows ?? []);
    } else setPayments([]);

    const userIds = (childrenRes.data ?? []).map((child: any) => child.user_id);
    if (userIds.length) {
      const { data: profileRows, error: profileError } = await db.from("profiles").select("id,name,username,grade,age").in("id", userIds);
      if (profileError) toast.error(profileError.message);
      setProfiles(Object.fromEntries((profileRows ?? []).map((profile: any) => [profile.id, profile])));
    }

    setLoading(false);
  }, [schoolId, activeMembership?.id, selectedChildId, db]);

  useEffect(() => { void load(); }, [load]);

  const selectedChild = children.find((child) => child.id === selectedChildId);
  const childName = (child: any) => profiles[child.user_id]?.name || child.school_username || "Student";
  const selectedResults = results.filter((result) => result.student_membership_id === selectedChildId);
  const selectedAttendance = attendanceRecords.filter((record) => record.student_membership_id === selectedChildId);
  const selectedBehavior = behaviorReports.filter((report) => report.student_membership_id === selectedChildId);
  const selectedHomework = homework.filter((item) => item.section_id === selectedChild?.section_id);
  const selectedSubmissions = homeworkSubmissions.filter((submission) => submission.student_membership_id === selectedChildId);
  const selectedInvoices = invoices.filter((invoice) => invoice.student_membership_id === selectedChildId);
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const outstandingByCurrency = selectedInvoices.reduce((totals: Record<string, number>, invoice) => {
    const currency = invoice.currency || "ETB";
    totals[currency] = (totals[currency] || 0) + Number(invoice.balance || 0);
    return totals;
  }, {});
  const outstandingSummary = Object.entries(outstandingByCurrency).map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`).join(" · ") || "0";

  const memberName = (membershipId: string) => {
    const child = children.find((item) => item.id === membershipId);
    if (child) return childName(child);
    const contact = contacts.find((item) => item.contact_membership_id === membershipId);
    if (contact) return contact.contact_name;
    return "School member";
  };
  const sectionLabel = (sectionId: string | null) => {
    const child = children.find((item) => item.section_id === sectionId);
    return child?.grade_label || "School section";
  };

  const loadContactsForChild = async (student: any) => {
    if (!student?.id) { setContacts([]); return; }
    const { data, error } = await db.rpc("school_parent_school_contacts", { p_student_membership_id: student.id });
    if (error) {
      setContacts([]);
      toast.error(error.message);
      return;
    }
    setContacts(data ?? []);
  };

  useEffect(() => { if (selectedChild) void loadContactsForChild(selectedChild); else setContacts([]); }, [selectedChild?.id]);

  const markNotificationRead = async (notification: any) => {
    const { error } = await db.from("school_parent_notifications").update({ read_at: new Date().toISOString() }).eq("id", notification.id);
    if (error) return toast.error(error.message);
    await load();
  };

  const createConversation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedChildId || !newTeacherId) return toast.error("Choose a teacher or School Admin for this conversation.");
    const { data, error } = await db.rpc("school_create_conversation", {
      p_school_id: schoolId,
      p_conversation_type: "direct",
      p_student_membership_id: selectedChildId,
      p_participant_membership_ids: [activeMembership?.id, newTeacherId].filter(Boolean),
      p_subject_name: null,
    });
    if (error) return toast.error(error.message);
    setSelectedConversationId(data);
    setNewTeacherId("");
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
    if (!selectedConversationId || !newMessage.trim()) return;
    const { error } = await db.from("school_messages").insert({
      school_id: schoolId, conversation_id: selectedConversationId,
      sender_membership_id: activeMembership?.id, body: newMessage.trim(),
    });
    if (error) return toast.error(error.message);
    setNewMessage("");
    const { data } = await db.from("school_messages").select("id,body,sender_membership_id,created_at").eq("school_id", schoolId).eq("conversation_id", selectedConversationId).order("created_at", { ascending: true });
    setMessages(data ?? []);
  };

  const renderChildSelector = () => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="w-full max-w-sm"><SchoolField label="Viewing child"><select className={schoolSelectClass} value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}><option value="">Choose child</option>{children.map((child) => <option key={child.id} value={child.id}>{childName(child)} · {child.grade_label || "Student"}</option>)}</select></SchoolField></div>
      <SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <SchoolPageHeading title="Parent overview" description="Follow your children's school progress, attendance, behavior, homework, and fees." />
      {renderChildSelector()}
      {!selectedChild ? <SchoolEmptyState title="No linked children" description="Contact the School Admin to link your parent account to your children." /> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SchoolMetric label="Published subject results" value={selectedResults.length} detail="Official results only" icon={GraduationCap} />
          <SchoolMetric label="Attendance records" value={selectedAttendance.length} detail="Daily homeroom attendance" icon={CalendarCheck} />
          <SchoolMetric label="Behavior reports" value={selectedBehavior.length} detail="Approved reports" icon={ShieldCheck} />
          <SchoolMetric label="Outstanding fees" value={outstandingSummary} detail="Current school invoices" icon={Wallet} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <SchoolPanel title="Latest announcements">
            {announcements.length ? <div className="divide-y divide-slate-100">{announcements.slice(0, 5).map((item) => <div key={item.id} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.body}</p><p className="mt-1 text-[11px] capitalize text-slate-500">{item.audience_type} · {new Date(item.created_at).toLocaleDateString()}</p></div>)}</div> : <SchoolEmptyState title="No announcements" description="School announcements will appear here." />}
          </SchoolPanel>
          <SchoolPanel title="Recent notifications" description={`${unreadCount} unread notifications`}>
            {notifications.length ? <div className="divide-y divide-slate-100">{notifications.slice(0, 5).map((item) => <div key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-600">{item.message}</p></div>{!item.read_at && <button onClick={() => void markNotificationRead(item)} className="shrink-0 text-xs font-semibold text-blue-700 hover:underline">Mark read</button>}</div>)}</div> : <SchoolEmptyState title="No notifications" description="Attendance, behavior, and school updates will appear here." />}
          </SchoolPanel>
        </div>
        <SchoolPanel title="Individual Master Minds learning">
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-800">School records are connected.</p>
            <p className="mt-1 text-xs text-slate-600">Individual subscription activity is separate from school records. It will only appear here when the child's individual learning account is explicitly linked and authorized.</p>
          </div>
        </SchoolPanel>
      </>}
    </div>
  );

  const renderChildren = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="My children" description="One parent account can be linked to multiple students in this school." />
      {children.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children.map((child) => <button key={child.id} onClick={() => { setSelectedChildId(child.id); setPage("overview"); }} className={["rounded-lg border p-4 text-left transition", selectedChildId === child.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"].join(" ")}><p className="text-sm font-semibold text-slate-900">{childName(child)}</p><p className="mt-1 text-xs text-slate-500">{child.grade_label || "Grade not assigned"} · {child.school_username}</p><div className="mt-3"><SchoolStatus value={child.status} /></div></button>)}</div> : <SchoolEmptyState title="No linked children" description="Ask the School Admin to link your parent account to your children." />}
    </div>
  );

  const renderResults = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Academic results" description="Only official results published by the School Admin are shown here." />
      {renderChildSelector()}
      {selectedResults.length ? <SchoolPanel title="Published report card">
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Term</th><th className="pb-2">Subject</th><th className="pb-2">Average</th><th className="pb-2">Grade</th><th className="pb-2">Rank</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedResults.map((result) => <tr key={result.id}><td className="py-3 text-slate-600">{terms.find((term) => term.id === result.term_id)?.name || "Term"}</td><td className="py-3 font-medium text-slate-800">{result.subject_name}</td><td className="py-3 tabular-nums text-slate-700">{result.average_score ?? "—"}</td><td className="py-3 text-slate-600">{result.letter_grade || "—"}</td><td className="py-3 tabular-nums text-slate-600">{result.rank_position ?? "—"}</td></tr>)}</tbody></table></div>
      </SchoolPanel> : <SchoolEmptyState title="No published results yet" description="Official averages and ranks will appear after the School Admin publishes the term results." />}
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Attendance history" description="Daily attendance updates recorded by the child's homeroom teacher." />
      {renderChildSelector()}
      {selectedAttendance.length ? <SchoolPanel title="Daily attendance">
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Date</th><th className="pb-2">Class</th><th className="pb-2">Attendance</th><th className="pb-2">Note</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedAttendance.map((record) => { const session = attendanceSessions.find((item) => item.id === record.session_id); return <tr key={record.id}><td className="py-3 text-slate-600">{session?.attendance_date || new Date(record.created_at).toLocaleDateString()}</td><td className="py-3 text-slate-600">{sectionLabel(session?.section_id || selectedChild?.section_id)}</td><td className="py-3"><SchoolStatus value={record.attendance_status} /></td><td className="py-3 text-slate-600">{record.note || "—"}</td></tr>; })}</tbody></table></div>
      </SchoolPanel> : <SchoolEmptyState title="No attendance records" description="Attendance records will appear after the homeroom teacher submits daily attendance." />}
    </div>
  );

  const renderBehavior = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Behavior reports" description="Approved behavior reports from teachers and the homeroom teacher." />
      {renderChildSelector()}
      {selectedBehavior.length ? <SchoolPanel title="Approved behavior history">
        <div className="space-y-3">{selectedBehavior.map((report) => <div key={report.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold capitalize text-slate-800">{report.report_type.replace("_", " ")}</p><SchoolStatus value={report.severity} /></div><p className="mt-2 text-sm text-slate-700">{report.description}</p>{report.review_note && <p className="mt-2 text-xs text-slate-600">School note: {report.review_note}</p>}<p className="mt-2 text-[11px] text-slate-500">Reviewed {report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString() : "by school"}</p></div>)}</div>
      </SchoolPanel> : <SchoolEmptyState title="No approved behavior reports" description="Reports will appear here after homeroom review." />}
    </div>
  );

  const renderHomework = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Homework" description="See approved homework assigned to your children's classes and check submission status." />
      {renderChildSelector()}
      {selectedHomework.length ? <SchoolPanel title="Class homework">
        <div className="space-y-3">{selectedHomework.map((item) => { const submission = selectedSubmissions.find((row) => row.homework_id === item.id); return <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject_name} · Due {item.due_at ? new Date(item.due_at).toLocaleString() : "No due date"}</p></div><SchoolStatus value={submission?.status || "not_submitted"} /></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.instructions}</p>{submission?.feedback && <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">Teacher feedback: {submission.feedback}</p>}{submission?.grade !== null && submission?.grade !== undefined && <p className="mt-1 text-xs font-semibold text-slate-700">Grade: {submission.grade}</p>}</div>; })}</div>
      </SchoolPanel> : <SchoolEmptyState title="No approved homework" description="Teacher homework will appear after School Admin approval." />}
    </div>
  );

  const renderFees = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School fees & payments" description="Review invoices, balances, payment history, and receipts for the selected child." />
      {renderChildSelector()}
      <div className="grid gap-3 sm:grid-cols-3"><SchoolMetric label="Invoices" value={selectedInvoices.length} detail="School-issued invoices" icon={Wallet} /><SchoolMetric label="Outstanding" value={outstandingSummary} detail="Unpaid balances" icon={Wallet} /><SchoolMetric label="Payments" value={payments.filter((payment) => selectedInvoices.some((invoice) => invoice.id === payment.invoice_id)).length} detail="Confirmed payment records" icon={Check} /></div>
      <SchoolPanel title="Invoices">
        {selectedInvoices.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Invoice</th><th className="pb-2">Description</th><th className="pb-2">Amount</th><th className="pb-2">Balance</th><th className="pb-2">Due date</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedInvoices.map((invoice) => <tr key={invoice.id}><td className="py-3 font-medium text-slate-800">{invoice.invoice_number}</td><td className="py-3 text-slate-600">{invoice.description}</td><td className="py-3 text-slate-600">{invoice.currency} {Number(invoice.amount).toLocaleString()}</td><td className="py-3 font-medium text-slate-800">{invoice.currency} {Number(invoice.balance).toLocaleString()}</td><td className="py-3 text-slate-600">{invoice.due_date || "—"}</td><td className="py-3"><SchoolStatus value={invoice.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No invoices" description="Invoices issued by School Finance will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Payment history">
        {payments.filter((payment) => selectedInvoices.some((invoice) => invoice.id === payment.invoice_id)).length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Receipt</th><th className="pb-2">Invoice</th><th className="pb-2">Amount</th><th className="pb-2">Method</th><th className="pb-2">Date</th></tr></thead><tbody className="divide-y divide-slate-100">{payments.filter((payment) => selectedInvoices.some((invoice) => invoice.id === payment.invoice_id)).map((payment) => <tr key={payment.id}><td className="py-3 font-medium text-slate-800">{payment.receipt_number}</td><td className="py-3 text-slate-600">{selectedInvoices.find((invoice) => invoice.id === payment.invoice_id)?.invoice_number}</td><td className="py-3 text-slate-600">{payment.amount.toLocaleString()}</td><td className="py-3 capitalize text-slate-600">{payment.payment_method.replace("_", " ")}</td><td className="py-3 text-slate-600">{new Date(payment.received_at).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No payments recorded" description="Confirmed payments and receipts will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Messages with school staff" description="Message teachers assigned to your selected child's class." />
      {renderChildSelector()}
      <SchoolPanel title="Start a teacher conversation">
        <form onSubmit={createConversation} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full max-w-sm"><SchoolField label="Teacher or School Admin"><select className={schoolSelectClass} value={newTeacherId} onChange={(event) => setNewTeacherId(event.target.value)}><option value="">Choose school contact</option>{contacts.map((contact) => <option key={contact.contact_membership_id} value={contact.contact_membership_id}>{contact.contact_name} · {contact.contact_role}{contact.subject_name ? ` · ${contact.subject_name}` : ""}</option>)}</select></SchoolField></div>
          <SchoolPrimaryButton type="submit"><Send className="mr-2 h-4 w-4" />Start conversation</SchoolPrimaryButton>
        </form>
      </SchoolPanel>
      <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
        <SchoolPanel title="Conversations">{conversations.length ? <div className="space-y-1">{conversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={["w-full rounded-md border px-3 py-2.5 text-left", selectedConversationId === conversation.id ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-slate-50"].join(" ")}><p className="text-sm font-medium text-slate-800">{conversation.conversation_type === "class" ? "Class conversation" : childName(children.find((child) => child.id === conversation.student_membership_id) || {})}</p><p className="mt-1 text-xs text-slate-500">{conversation.subject_name || "School conversation"}</p></button>)}</div> : <SchoolEmptyState title="No conversations" description="Start a conversation with an assigned teacher." />}</SchoolPanel>
        <SchoolPanel title="Messages">{selectedConversationId ? <><div className="max-h-[420px] space-y-3 overflow-y-auto">{messages.map((message) => <div key={message.id} className={["max-w-[85%] rounded-lg px-3 py-2 text-sm", message.sender_membership_id === activeMembership?.id ? "ml-auto bg-blue-600 text-white" : "bg-slate-100 text-slate-800"].join(" ")}><p>{message.body}</p><p className="mt-1 text-[10px] opacity-70">{new Date(message.created_at).toLocaleString()}</p></div>)}</div><form onSubmit={sendMessage} className="mt-4 flex gap-2"><input className={schoolInputClass} value={newMessage} onChange={(event) => setNewMessage(event.target.value)} placeholder="Write a message…" /><SchoolPrimaryButton type="submit"><Send className="h-4 w-4" /></SchoolPrimaryButton></form></> : <SchoolEmptyState title="Select a conversation" description="Choose a conversation to read and reply." />}</SchoolPanel>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School notifications" description="Attendance updates, approved behavior reports, fee reminders, and school communications." />
      <SchoolPanel title="Notifications" description={`${unreadCount} unread`}>
        {notifications.length ? <div className="divide-y divide-slate-100">{notifications.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.message}</p><p className="mt-1 text-[11px] capitalize text-slate-500">{item.notification_type} · {new Date(item.created_at).toLocaleString()}</p></div>{!item.read_at && <button onClick={() => void markNotificationRead(item)} className="shrink-0 text-xs font-semibold text-blue-700 hover:underline">Mark read</button>}</div>)}</div> : <SchoolEmptyState title="No notifications" description="School notifications will appear here." />}
      </SchoolPanel>
    </div>
  );

  let content: React.ReactNode;
  switch (page) {
    case "children": content = renderChildren(); break;
    case "results": content = renderResults(); break;
    case "attendance": content = renderAttendance(); break;
    case "behavior": content = renderBehavior(); break;
    case "homework": content = renderHomework(); break;
    case "fees": content = renderFees(); break;
    case "messages": content = renderMessages(); break;
    case "notifications": content = renderNotifications(); break;
    default: content = renderOverview();
  }

  return (
    <SchoolPortalShell role="parent" title="Parent Portal" navItems={navItems} activeItem={page} onNavigate={setPage}>
      {loading && <div className="mb-4 text-xs text-slate-500">Refreshing your children's school records…</div>}
      {content}
    </SchoolPortalShell>
  );
}
