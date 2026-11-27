import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, RefreshCw, UserRound, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ChildControls = {
  child_id: string;
  child_name: string;
  child_username: string;
  child_grade: string | null;
  child_age: number | null;
  social_enabled: boolean;
  friend_requests_enabled: boolean;
  direct_messages_enabled: boolean;
  multiplayer_enabled: boolean;
  calls_enabled: boolean;
  profile_public: boolean;
};

const GuardianControlsPage: React.FC = () => {
  const [children, setChildren] = useState<ChildControls[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingChild, setSavingChild] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("list_guardian_children");
    if (error) {
      toast.error(error.message || "Parent controls could not be loaded.");
      setChildren([]);
    } else {
      setChildren((data || []) as ChildControls[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveControls = async (child: ChildControls, next: ChildControls) => {
    setSavingChild(child.child_id);
    const { error } = await (supabase as any).rpc("update_guardian_child_controls", {
      p_child_id: child.child_id,
      p_social_enabled: next.social_enabled,
      p_friend_requests_enabled: next.friend_requests_enabled,
      p_direct_messages_enabled: next.direct_messages_enabled,
      p_multiplayer_enabled: next.multiplayer_enabled,
      p_calls_enabled: next.calls_enabled,
      p_profile_public: next.profile_public,
    });
    setSavingChild(null);
    if (error) {
      toast.error(error.message || "Parent control could not be updated.");
      return false;
    }
    setChildren(current => current.map(item => item.child_id === child.child_id ? next : item));
    return true;
  };

  const update = async (child: ChildControls, key: keyof ChildControls, value: boolean) => {
    const next = { ...child, [key]: value };
    if (key === "social_enabled" && !value) {
      next.friend_requests_enabled = false;
      next.direct_messages_enabled = false;
      next.multiplayer_enabled = false;
      next.calls_enabled = false;
      next.profile_public = false;
    }
    if (await saveControls(child, next)) toast.success("Parent control updated.");
  };

  const enableCommunityBundle = async (child: ChildControls) => {
    const confirmed = window.confirm(
      `Enable friend requests, direct and group messages, multiplayer, and Study Mode calls for ${child.child_name}? Messaging remains limited to accepted friends or approved groups, calls to accepted friends, and public profile visibility stays off. You can change these settings at any time.`
    );
    if (!confirmed) return;
    const next = {
      ...child,
      social_enabled: true,
      friend_requests_enabled: true,
      direct_messages_enabled: true,
      multiplayer_enabled: true,
      calls_enabled: true,
      profile_public: false,
    };
    if (await saveControls(child, next)) {
      toast.success("Friends and study-together features enabled. Public profile remains private.");
    }
  };

  const revoke = async (child: ChildControls) => {
    if (!window.confirm(`Revoke community consent for ${child.child_name}? This turns off all community features and removes their parent link.`)) return;
    setSavingChild(child.child_id);
    const { error } = await (supabase as any).rpc("revoke_guardian_consent", { p_child_id: child.child_id });
    setSavingChild(null);
    if (error) {
      toast.error(error.message || "Consent could not be revoked.");
      return;
    }
    toast.success("Guardian consent revoked and community features disabled.");
    await load();
  };

  const control = (child: ChildControls, key: keyof ChildControls, label: string, description: string) => (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={Boolean(child[key])}
        disabled={savingChild === child.child_id || (key !== "social_enabled" && !child.social_enabled)}
        onCheckedChange={(value) => void update(child, key, value)}
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Master Minds · Parent Portal</p>
            <h1 className="mt-1 text-2xl font-bold">Learner access controls</h1>
            <p className="mt-2 text-sm text-muted-foreground">Learning tools are available by default. These settings only manage social and community features for linked learners.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">How access works</p>
          <p className="mt-1">Lessons, quizzes, textbooks, study tools, and academic progress do not require community approval. For learners under 18, a verified parent or guardian manages friend requests, messaging, multiplayer, and calls. Public profile visibility is always a separate choice.</p>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading linked learners…</p>}
        {!loading && children.length === 0 && <Card><CardContent className="p-6 text-center"><UserRound className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No verified learner links yet</p><p className="mt-1 text-sm text-muted-foreground">When a learner sends an approval request to this verified parent email and you approve it, the account will appear here.</p></CardContent></Card>}
        {children.map(child => (
          <Card key={child.child_id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />{child.child_name}</CardTitle>
                  <CardDescription>@{child.child_username}{child.child_grade ? ` · ${child.child_grade}` : ""}{child.child_age != null ? ` · Age ${child.child_age}` : ""}</CardDescription>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">Verified guardian link</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <div><p className="text-sm font-medium">Friends and study together</p><p className="text-xs text-muted-foreground">One-step approval for the private community features below</p></div>
                </div>
                <Button size="sm" variant="outline" onClick={() => void enableCommunityBundle(child)} disabled={savingChild === child.child_id || (child.social_enabled && child.friend_requests_enabled && child.direct_messages_enabled && child.multiplayer_enabled && child.calls_enabled)}>
                  Enable these features
                </Button>
              </div>
              {control(child, "social_enabled", "Community access", "Master switch for social and community interactions")}
              {control(child, "friend_requests_enabled", "Friend requests", "Allow sending and receiving friend requests")}
              {control(child, "direct_messages_enabled", "Direct and group messages", "Messaging is limited to accepted friends and approved groups")}
              {control(child, "multiplayer_enabled", "Multiplayer and competitions", "Allow multiplayer rooms, invitations, and study competitions")}
              {control(child, "calls_enabled", "Study Mode calls", "Allow voice and video calls with accepted friends")}
              {control(child, "profile_public", "Public profile", "Separate opt-in: allow the learner profile and posts to be visible to opted-in users")}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Changes apply to new access and interactions immediately.</p>
                <Button variant="destructive" size="sm" onClick={() => void revoke(child)} disabled={savingChild === child.child_id}>Revoke consent</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        <p className="text-center text-xs text-muted-foreground">Need help? <a className="underline" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a> · <Link className="underline" to="/privacy">Privacy Policy</Link></p>
      </div>
    </main>
  );
};

export default GuardianControlsPage;
