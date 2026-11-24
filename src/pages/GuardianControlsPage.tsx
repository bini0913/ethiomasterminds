import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type GuardianStudent = {
  student_id: string;
  student_name: string | null;
  username: string | null;
  grade: string | null;
  age: number | null;
  allow_friends: boolean;
  allow_direct_messages: boolean;
  allow_group_chat: boolean;
  allow_public_posts: boolean;
  allow_multiplayer: boolean;
  allow_study_calls: boolean;
};

type ControlKey =
  | "allow_friends"
  | "allow_direct_messages"
  | "allow_group_chat"
  | "allow_public_posts"
  | "allow_multiplayer"
  | "allow_study_calls";

const controlItems: { key: ControlKey; title: string; description: string }[] = [
  { key: "allow_friends", title: "Friend connections", description: "Allow this learner to send and accept friend requests" },
  { key: "allow_direct_messages", title: "Direct messages", description: "Allow private messages between approved friends" },
  { key: "allow_group_chat", title: "Group chat", description: "Allow this learner to participate in group conversations" },
  { key: "allow_public_posts", title: "Social posts and comments", description: "Allow creating posts, commenting, and reacting in the social feed" },
  { key: "allow_multiplayer", title: "Multiplayer and tournaments", description: "Allow multiplayer rooms, lobby chat, and tournament participation" },
  { key: "allow_study_calls", title: "Study Mode calls", description: "Allow voice and video study calls with approved participants" },
];

const GuardianControlsPage: React.FC = () => {
  const [students, setStudents] = useState<GuardianStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_my_guardian_students");
      if (error) throw error;
      setStudents((data || []) as GuardianStudent[]);
    } catch (error) {
      console.error("Could not load guardian-linked learners:", error);
      toast.error("Could not load guardian controls. Please sign in with the verified guardian email.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const updateControl = async (student: GuardianStudent, key: ControlKey, value: boolean) => {
    const next = { ...student, [key]: value };
    setBusyKey(`${student.student_id}:${key}`);
    try {
      const { error } = await (supabase as any).rpc("update_guardian_social_controls", {
        p_student_id: student.student_id,
        p_allow_friends: next.allow_friends,
        p_allow_direct_messages: next.allow_direct_messages,
        p_allow_group_chat: next.allow_group_chat,
        p_allow_public_posts: next.allow_public_posts,
        p_allow_multiplayer: next.allow_multiplayer,
        p_allow_study_calls: next.allow_study_calls,
      });
      if (error) throw error;
      setStudents((current) => current.map((item) => item.student_id === student.student_id ? next : item));
      toast.success(`${controlItems.find((item) => item.key === key)?.title || "Control"} updated.`);
    } catch (error) {
      console.error("Could not update guardian control:", error);
      toast.error("Could not update this control. Please retry.");
    } finally {
      setBusyKey(null);
    }
  };

  const revoke = async (student: GuardianStudent) => {
    const name = student.student_name || student.username || "this learner";
    if (!window.confirm(`Revoke guardian consent for ${name}? All social and communication controls will be turned off immediately.`)) return;
    setBusyKey(`${student.student_id}:revoke`);
    try {
      const { error } = await (supabase as any).rpc("revoke_guardian_consent", {
        p_student_id: student.student_id,
      });
      if (error) throw error;
      setStudents((current) => current.filter((item) => item.student_id !== student.student_id));
      toast.success("Guardian consent revoked. Social controls are now disabled.");
    } catch (error) {
      console.error("Could not revoke guardian consent:", error);
      toast.error("Could not revoke consent. Please contact support.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Master Minds
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Family safety</p>
            <h1 className="mt-2 text-3xl font-bold">Guardian Controls</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Choose which social and communication features each linked learner can use. Every feature starts off, and changes apply immediately.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadStudents()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading verified guardian links…</CardContent></Card>
        ) : students.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No linked learners yet</h2>
              <p className="text-sm text-muted-foreground">When a learner sends a guardian approval request to your verified email and you approve it, their controls will appear here.</p>
            </CardContent>
          </Card>
        ) : students.map((student) => (
          <Card key={student.student_id} className="border-border/70">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{student.student_name || student.username || "Learner"}</CardTitle>
                  <CardDescription>
                    {student.username ? `@${student.username}` : "Master Minds learner"}
                    {student.grade ? ` · ${student.grade}` : ""}
                    {student.age ? ` · Age ${student.age}` : ""}
                  </CardDescription>
                </div>
                <Badge variant="outline">Verified guardian link</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {controlItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <Switch
                    checked={student[item.key]}
                    disabled={busyKey === `${student.student_id}:${item.key}` || busyKey === `${student.student_id}:revoke`}
                    onCheckedChange={(value) => void updateControl(student, item.key, value)}
                    aria-label={`Allow ${item.title} for ${student.student_name || student.username || "learner"}`}
                  />
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">You can change or revoke these settings at any time.</p>
                <Button size="sm" variant="destructive" onClick={() => void revoke(student)} disabled={busyKey === `${student.student_id}:revoke`}>
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Revoke consent
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <p className="text-xs text-muted-foreground">
          Need help? Contact Masterminds Support Team at <a className="underline underline-offset-4" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>.
        </p>
      </div>
    </main>
  );
};

export default GuardianControlsPage;
