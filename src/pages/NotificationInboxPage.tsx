import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Archive, MessageCircle, Trophy, Gamepad2, BookOpen, Users, Clock3, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BackButton from "@/components/ui/BackButton";
import { useUser } from "@/context/UserContext";
import { db } from "@/integrations/untypedClient";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NotificationEvent = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  delivered_at: string | null;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
};

type Filter = "all" | "unread";

const iconForKind = (kind: string) => {
  if (kind.includes("friend") || kind.includes("social")) return Users;
  if (kind.includes("message")) return MessageCircle;
  if (kind.includes("invite") || kind.includes("call")) return Gamepad2;
  if (kind.includes("assignment") || kind.includes("announcement")) return BookOpen;
  if (kind.includes("achievement") || kind.includes("streak")) return Trophy;
  return Bell;
};

const labelForKind = (kind: string) => kind.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function NotificationInboxPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(false);
    const { data, error } = await db
      .from("notification_events" as any)
      .select("id,user_id,kind,title,body,data,delivered_at,created_at,read_at,archived_at")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setItems((data ?? []) as NotificationEvent[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) void load();
  }, [load, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notification-inbox-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notification_events",
        filter: `user_id=eq.${user.id}`,
      }, () => { void load(); })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Notification inbox realtime subscription:", status);
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [load, user?.id]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);
  const visibleItems = useMemo(
    () => filter === "unread" ? items.filter((item) => !item.read_at) : items,
    [filter, items],
  );

  const markRead = async (item: NotificationEvent) => {
    if (!user?.id || item.read_at) return;
    setBusyId(item.id);
    const readAt = new Date().toISOString();
    const { error } = await db.from("notification_events" as any)
      .update({ read_at: readAt })
      .eq("id", item.id)
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) {
      toast.error("Could not mark this notification as read.");
      setBusyId(null);
      return;
    }
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
    setBusyId(null);
  };

  const openItem = async (item: NotificationEvent) => {
    await markRead(item);
    const route = item.data?.route;
    if (typeof route === "string" && route.startsWith("/") && !route.startsWith("//")) navigate(route);
  };

  const archiveItem = async (item: NotificationEvent) => {
    if (!user?.id) return;
    setBusyId(item.id);
    const archivedAt = new Date().toISOString();
    const { error } = await db.from("notification_events" as any)
      .update({ archived_at: archivedAt, read_at: item.read_at ?? archivedAt })
      .eq("id", item.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Could not archive this notification.");
      setBusyId(null);
      return;
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setBusyId(null);
  };

  const markAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    setMarkingAll(true);
    const readAt = new Date().toISOString();
    const { error } = await db.from("notification_events" as any)
      .update({ read_at: readAt })
      .eq("user_id", user.id)
      .is("read_at", null)
      .is("archived_at", null);
    if (error) {
      toast.error("Could not mark notifications as read.");
    } else {
      setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    }
    setMarkingAll(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <BackButton />
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold">Notifications</h1>
            <p className="text-xs text-muted-foreground">Your announcements, messages and activity alerts</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/notification-settings")}>Settings</Button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl space-y-4 p-4 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Notification inbox</p>
            <p className="text-2xl font-bold">{unreadCount} unread</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" onClick={() => void markAllRead()} disabled={markingAll || unreadCount === 0}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
            </Button>
          </div>
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Notification filter">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          <Button size="sm" variant={filter === "unread" ? "default" : "outline"} onClick={() => setFilter("unread")}>Unread</Button>
        </div>

        {loading ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading your notifications…</CardContent></Card>
        ) : loadError ? (
          <Card><CardContent className="space-y-3 p-8 text-center">
            <p className="font-semibold">Notifications couldn’t be loaded.</p>
            <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button variant="outline" onClick={() => void load()}>Try again</Button>
          </CardContent></Card>
        ) : visibleItems.length === 0 ? (
          <Card><CardContent className="space-y-2 p-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">{filter === "unread" ? "You’re all caught up." : "No notifications yet."}</p>
            <p className="text-sm text-muted-foreground">New announcements, assignments and activity alerts will appear here.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => {
              const Icon = iconForKind(item.kind);
              return (
                <Card key={item.id} className={item.read_at ? "border-border/70" : "border-primary/40 bg-primary/[0.03]"}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="mt-0.5 rounded-xl bg-muted p-2"><Icon className="h-5 w-5 text-primary" /></div>
                    <button type="button" onClick={() => void openItem(item)} className="min-w-0 flex-1 text-left" disabled={busyId === item.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{item.title}</span>
                        {!item.read_at && <Badge variant="default">New</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{labelForKind(item.kind)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </button>
                    <Button variant="ghost" size="icon" aria-label="Archive notification" title="Archive notification" disabled={busyId === item.id} onClick={() => void archiveItem(item)}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
