import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, MessageSquare, Megaphone, Users, RefreshCw, Search, CalendarClock, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SchoolEmptyState, SchoolField, SchoolMetric, SchoolPageHeading, SchoolPanel, SchoolStatus,
  SchoolSecondaryButton, schoolInputClass, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";

type Props = {
  schoolId?: string;
  members: any[];
  profiles: Record<string, any>;
  sections: any[];
};

type Announcement = {
  id: string; school_id: string; title: string; body: string; audience_type: string;
  grade_label: string | null; section_id: string | null; created_by_membership_id: string;
  status: string; reviewed_by_membership_id: string | null; reviewed_at: string | null;
  review_feedback: string | null; published_at: string | null; created_at: string; updated_at: string;
};
type ParentNotification = {
  id: string; school_id: string; parent_membership_id: string; student_membership_id: string;
  notification_type: string; title: string; read_at: string | null; created_at: string;
};
type Conversation = {
  id: string; school_id: string; conversation_type: string; section_id: string | null;
  student_membership_id: string | null; subject_name: string | null;
  created_by_membership_id: string; created_at: string; last_message_at: string | null;
  archived_at: string | null;
};
type MessageMeta = { id: string; conversation_id: string; sender_membership_id: string; created_at: string };
type ParentLink = { id: string; parent_membership_id: string; student_membership_id: string; status: string; linked_at: string; ended_at: string | null };

const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";
const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export default function SchoolManagerParentCommunicationsWorkspace({ schoolId, members, profiles, sections }: Props) {
  const db = supabase as any;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messageMeta, setMessageMeta] = useState<MessageMeta[]>([]);
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"announcements" | "parents" | "messages">("announcements");
  const [announcementStatus, setAnnouncementStatus] = useState("all");
  const [announcementSearch, setAnnouncementSearch] = useState("");
  const [notificationStatus, setNotificationStatus] = useState("all");
  const [notificationType, setNotificationType] = useState("all");
  const [conversationFilter, setConversationFilter] = useState("all");
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!schoolId) {
      setAnnouncements([]); setNotifications([]); setConversations([]); setMessageMeta([]); setParentLinks([]);
      setLoading(false); setError(""); return;
    }
    setLoading(true); setError("");
    try {
      const [announcementResult, notificationResult, conversationResult, linkResult] = await Promise.all([
        db.from("school_announcements")
          .select("id,school_id,title,body,audience_type,grade_label,section_id,created_by_membership_id,status,reviewed_by_membership_id,reviewed_at,review_feedback,published_at,created_at,updated_at")
          .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1500),
        db.from("school_parent_notifications")
          .select("id,school_id,parent_membership_id,student_membership_id,notification_type,title,read_at,created_at")
          .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(3000),
        db.from("school_conversations")
          .select("id,school_id,conversation_type,section_id,student_membership_id,subject_name,created_by_membership_id,created_at,last_message_at,archived_at")
          .eq("school_id", schoolId).order("last_message_at", { ascending: false, nullsFirst: false }).limit(1500),
        db.from("school_parent_student_links")
          .select("id,parent_membership_id,student_membership_id,status,linked_at,ended_at")
          .eq("school_id", schoolId).order("linked_at", { ascending: false }).limit(3000),
      ]);
      if (requestId !== requestSequence.current) return;
      const failures = [
        announcementResult.error && "Announcements: " + announcementResult.error.message,
        notificationResult.error && "Parent notifications: " + notificationResult.error.message,
        conversationResult.error && "Conversations: " + conversationResult.error.message,
        linkResult.error && "Parent links: " + linkResult.error.message,
      ].filter(Boolean);
      if (failures.length) throw new Error(failures.join(" · "));
      const nextConversations = (conversationResult.data || []) as Conversation[];
      setAnnouncements((announcementResult.data || []) as Announcement[]);
      setNotifications((notificationResult.data || []) as ParentNotification[]);
      setConversations(nextConversations);
      setParentLinks((linkResult.data || []) as ParentLink[]);
      if (nextConversations.length) {
        const ids = nextConversations.map((conversation) => conversation.id);
        const messageResult = await db.from("school_messages")
          .select("id,conversation_id,sender_membership_id,created_at")
          .eq("school_id", schoolId).in("conversation_id", ids)
          .gte("created_at", daysAgo(30)).order("created_at", { ascending: false }).limit(5000);
        if (requestId !== requestSequence.current) return;
        if (messageResult.error) throw new Error("Message activity: " + messageResult.error.message);
        setMessageMeta((messageResult.data || []) as MessageMeta[]);
      } else setMessageMeta([]);
    } catch (cause) {
      if (requestId === requestSequence.current) setError(cause instanceof Error ? cause.message : "School communication records could not be loaded.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [db, schoolId]);

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);

  const memberName = (id?: string | null) => {
    const member = members.find((item) => item.id === id);
    if (!member) return "School member";
    const profile = profiles[member.user_id] || {};
    return profile.name || profile.full_name || profile.username || member.school_username || "School member";
  };
  const sectionName = (id?: string | null) => {
    const section = sections.find((item) => item.id === id);
    return section ? section.grade_label + " · " + section.section_name : "—";
  };
  const activeLinks = parentLinks.filter((link) => link.status === "active");
  const uniqueParents = new Set(activeLinks.map((link) => link.parent_membership_id));
  const pendingAnnouncements = announcements.filter((item) => item.status === "pending").length;
  const publishedAnnouncements = announcements.filter((item) => item.status === "published").length;
  const unreadNotifications = notifications.filter((item) => !item.read_at).length;
  const readNotifications = notifications.length - unreadNotifications;
  const recentMessages = messageMeta.filter((item) => item.created_at >= daysAgo(7)).length;
  const filteredAnnouncements = useMemo(() => announcements.filter((item) =>
    (announcementStatus === "all" || item.status === announcementStatus)
    && (!announcementSearch || (item.title + " " + item.body).toLowerCase().includes(announcementSearch.toLowerCase()))
  ), [announcements, announcementStatus, announcementSearch]);
  const filteredNotifications = notifications.filter((item) =>
    (notificationStatus === "all" || (notificationStatus === "unread" ? !item.read_at : !!item.read_at))
    && (notificationType === "all" || item.notification_type === notificationType)
  );
  const filteredConversations = conversations.filter((item) =>
    conversationFilter === "all" || (conversationFilter === "active" ? !item.archived_at : !!item.archived_at)
  );
  const conversationMessageCounts = useMemo(() => messageMeta.reduce((acc, item) => {
    acc[item.conversation_id] = (acc[item.conversation_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [messageMeta]);

  return (
    <div className="space-y-5">
      <SchoolPageHeading
        title="Parent communication & announcements"
        description="Monitor school announcements, parent notification delivery and read status, and messaging activity. This workspace does not expose private message contents or bypass announcement review permissions."
        action={<SchoolSecondaryButton onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh communication</SchoolSecondaryButton>}
      />
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Linked parent accounts" value={uniqueParents.size} detail={activeLinks.length + " active parent–student links"} icon={Users} />
        <SchoolMetric label="Announcements awaiting review" value={pendingAnnouncements} detail="Requires an authorized appointed leader" icon={Megaphone} />
        <SchoolMetric label="Parent notifications unread" value={unreadNotifications} detail={readNotifications + " marked read"} icon={Bell} />
        <SchoolMetric label="Messages in last 7 days" value={recentMessages} detail="Metadata only · last 30 days loaded" icon={MessageSquare} />
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(["announcements", "parents", "messages"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} aria-pressed={tab === item}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === item ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {item === "announcements" ? "Announcements" : item === "parents" ? "Parent engagement" : "Messaging activity"}
          </button>
        ))}
      </div>

      {tab === "announcements" && (
        <SchoolPanel title="School announcements" description="View the announcement lifecycle and selected audience. Pending items remain in the authorized leadership review queue.">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <SchoolField label="Search announcements"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className={schoolInputClass + " pl-9"} value={announcementSearch} onChange={(e) => setAnnouncementSearch(e.target.value)} placeholder="Search title or announcement text" /></div></SchoolField>
            <SchoolField label="Status"><select className={schoolSelectClass} value={announcementStatus} onChange={(e) => setAnnouncementStatus(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="pending">Pending review</option><option value="published">Published</option><option value="rejected">Rejected</option></select></SchoolField>
          </div>
          {filteredAnnouncements.length ? <div className="space-y-3">{filteredAnnouncements.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="font-semibold text-slate-900">{item.title}</h3><p className="mt-1 text-xs text-slate-500">Created by {memberName(item.created_by_membership_id)} · {dateTime(item.created_at)}</p></div>
                <SchoolStatus value={item.status} />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Audience: {item.audience_type === "grade" ? item.grade_label : item.audience_type === "section" ? sectionName(item.section_id) : item.audience_type}</span>
                {item.published_at && <span>Published: {dateTime(item.published_at)}</span>}
                {item.reviewed_at && <span>Reviewed by {memberName(item.reviewed_by_membership_id)} · {dateTime(item.reviewed_at)}</span>}
              </div>
              {item.review_feedback && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Review feedback: {item.review_feedback}</p>}
              {item.status === "pending" && <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Review and publication are restricted to appointed school leaders with the publish_announcements permission. The Manager workspace monitors this queue and cannot override that permission.</p>}
            </article>
          ))}</div> : <SchoolEmptyState title="No announcements match this filter" description="Announcements created by teachers and school leaders will appear here. No sample announcements are inserted." />}
        </SchoolPanel>
      )}

      {tab === "parents" && (
        <div className="space-y-5">
          <SchoolPanel title="Parent notification delivery" description="Read status is recorded by the parent account. Managers can monitor delivery and follow-up needs but cannot mark a parent's notification as read.">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <SchoolField label="Read status"><select className={schoolSelectClass} value={notificationStatus} onChange={(e) => setNotificationStatus(e.target.value)}><option value="all">All notifications</option><option value="unread">Unread</option><option value="read">Read</option></select></SchoolField>
              <SchoolField label="Notification type"><select className={schoolSelectClass} value={notificationType} onChange={(e) => setNotificationType(e.target.value)}><option value="all">All types</option><option value="announcement">Announcement</option><option value="message">Message</option></select></SchoolField>
            </div>
            {filteredNotifications.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-2">Parent</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Notification</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Read status</th></tr></thead><tbody>{filteredNotifications.slice(0, 250).map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="px-3 py-3 font-medium text-slate-800">{memberName(item.parent_membership_id)}</td><td className="px-3 py-3 text-slate-600">{memberName(item.student_membership_id)}</td><td className="px-3 py-3"><p className="font-medium text-slate-800">{item.title}</p><span className="text-xs capitalize text-slate-500">{item.notification_type}</span></td><td className="px-3 py-3 text-xs text-slate-500">{dateTime(item.created_at)}</td><td className="px-3 py-3">{item.read_at ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Read {dateTime(item.read_at)}</span> : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><Clock3 className="h-3.5 w-3.5" />Unread</span>}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-slate-500">Showing up to 250 of {filteredNotifications.length} matching notifications.</p></div> : <SchoolEmptyState title="No parent notifications match these filters" description="Notifications are created by existing announcement and school messaging workflows." />}
          </SchoolPanel>
          <SchoolPanel title="Parent–student link coverage" description="Counts are based on the existing school parent-link records. Link changes remain in the dedicated account and relationship workflows.">
            <div className="grid gap-3 sm:grid-cols-3"><SchoolMetric label="Active links" value={activeLinks.length} detail="Parent connected to a student" icon={Users} /><SchoolMetric label="Unique active parents" value={uniqueParents.size} detail="Distinct parent memberships" icon={Users} /><SchoolMetric label="Ended links" value={parentLinks.filter((link) => link.status !== "active").length} detail="Historical relationships retained" icon={CalendarClock} /></div>
          </SchoolPanel>
        </div>
      )}

      {tab === "messages" && (
        <SchoolPanel title="School messaging activity" description="Conversation metadata and message counts only. Private message bodies are intentionally not displayed in this manager overview.">
          <div className="mb-4 max-w-xs"><SchoolField label="Conversation status"><select className={schoolSelectClass} value={conversationFilter} onChange={(e) => setConversationFilter(e.target.value)}><option value="all">All conversations</option><option value="active">Active</option><option value="archived">Archived</option></select></SchoolField></div>
          {filteredConversations.length ? <div className="space-y-3">{filteredConversations.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold capitalize text-slate-900">{item.conversation_type === "class" ? "Class conversation" : "Direct conversation"}{item.subject_name ? " · " + item.subject_name : ""}</p><SchoolStatus value={item.archived_at ? "archived" : "active"} /></div>
              <p className="mt-1 text-sm text-slate-600">{item.student_membership_id ? "Student: " + memberName(item.student_membership_id) : "Section: " + sectionName(item.section_id)}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{conversationMessageCounts[item.id] || 0} messages in last 30 days loaded</span><span>Last activity: {dateTime(item.last_message_at)}</span><span>Started: {dateTime(item.created_at)}</span></div>
            </div>
          ))}</div> : <SchoolEmptyState title="No conversations match this filter" description="School conversations appear here as teachers, parents and students use the existing messaging system." />}
          <p className="mt-4 text-xs text-slate-500">The message count is limited to the most recent 30 days and 5,000 records. It is an activity indicator, not a complete message archive or a response-time SLA.</p>
        </SchoolPanel>
      )}
      {loading && <p className="text-xs text-slate-500">Refreshing parent communication records…</p>}
      <p className="text-xs text-slate-500">All records are scoped to the active school. Parent read state is parent-owned. Announcement approval remains with appointed leaders who hold the required permission.</p>
    </div>
  );
}
