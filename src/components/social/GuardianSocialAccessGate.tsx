import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, MailCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";

type PermissionKey = "allow_friends" | "allow_group_chat" | "allow_public_posts" | "allow_multiplayer";

type SocialAccess = {
  age: number | null;
  guardian_consent: boolean;
  guardian_email: string | null;
  allow_friends: boolean;
  allow_direct_messages: boolean;
  allow_group_chat: boolean;
  allow_public_posts: boolean;
  allow_multiplayer: boolean;
  allow_study_calls: boolean;
};

const GuardianSocialAccessGate: React.FC = () => {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [access, setAccess] = useState<SocialAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const permission = useMemo<PermissionKey | null>(() => {
    const path = location.pathname;
    if (path === "/friends" || path.startsWith("/friends/")) return "allow_friends";
    if (path === "/profile" || path.startsWith("/profile/")) return "allow_friends";
    if (path === "/chat" || path.startsWith("/chat/")) return "allow_group_chat";
    if (path === "/social" || path.startsWith("/social/")) return "allow_public_posts";
    if (path === "/multiplayer" || path.startsWith("/multiplayer/")) return "allow_multiplayer";
    if (path === "/lobby" || path.startsWith("/lobby/")) return "allow_multiplayer";
    if (path === "/tournaments" || path.startsWith("/tournaments/")) return "allow_multiplayer";
    return null;
  }, [location.pathname]);

  const loadAccess = useCallback(async () => {
    if (!user?.id || !permission) {
      setLoading(false);
      setAccess(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc("get_my_social_access");
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("Your account safety settings could not be found.");
      setAccess(row as SocialAccess);
      setGuardianEmail(row.guardian_email || "");
    } catch (loadError) {
      console.error("Could not load guardian social controls:", loadError);
      setError("We could not verify your parent or guardian settings. Social features remain locked until we can check them.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, permission]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess, retry]);

  if (!permission || !user?.id || user.role !== "student") return null;
  if (loading) {
    return (
      <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/70 p-4">
        <section className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl">
          <ShieldCheck className="mb-3 h-7 w-7 text-primary" />
          <h2 className="text-lg font-semibold">Checking guardian settings</h2>
          <p className="mt-2 text-sm text-muted-foreground">Please wait while Master Minds checks the social features enabled for your account.</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/70 p-4">
        <section className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl">
          <AlertCircle className="mb-3 h-7 w-7 text-destructive" />
          <h2 className="text-lg font-semibold">Could not verify guardian settings</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => setRetry((value) => value + 1)}>Retry</Button>
            <Button variant="outline" onClick={() => navigate("/")}>Return home</Button>
          </div>
        </section>
      </div>
    );
  }

  if (!access || access.age === null || access.age === undefined) {
    return (
      <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/70 p-4">
        <section className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl">
          <ShieldAlert className="mb-3 h-7 w-7 text-amber-600" />
          <h2 className="text-lg font-semibold">Age details need review</h2>
          <p className="mt-2 text-sm text-muted-foreground">Social features are unavailable until the age information on this student account can be verified. Contact Masterminds Support Team at mindm1517@gmail.com.</p>
          <Button className="mt-5" variant="outline" onClick={() => navigate("/")}>Return home</Button>
        </section>
      </div>
    );
  }

  if (access.age >= 18 || access[permission]) return null;

  const featureNames: Record<string, string> = {
    allow_friends: "friend connections",
    allow_group_chat: "group chat",
    allow_public_posts: "social posts and comments",
    allow_multiplayer: "multiplayer and tournament features",
  };
  const featureName = featureNames[permission] || "this social feature";

  const saveGuardianEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingEmail(true);
    try {
      const { error: saveError } = await (supabase as any).rpc("update_my_guardian_email", {
        p_guardian_email: guardianEmail.trim().toLowerCase(),
      });
      if (saveError) throw saveError;
      setLinkSent(false);
      await loadAccess();
    } catch (saveError) {
      console.error("Could not save guardian email:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save the guardian email.");
    } finally {
      setSavingEmail(false);
    }
  };

  const sendApprovalLink = async () => {
    if (!access.guardian_email) return;
    setSendingLink(true);
    try {
      const { data: requestId, error: requestError } = await (supabase as any).rpc("request_guardian_consent");
      if (requestError) throw requestError;
      const { error: emailError } = await supabase.auth.signInWithOtp({
        email: access.guardian_email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/guardian-consent?request=${requestId}`,
          data: {
            account_type: "individual_parent",
            age: 18,
            name: "Parent or Guardian",
          },
        },
      });
      if (emailError) throw emailError;
      setLinkSent(true);
    } catch (sendError) {
      console.error("Could not send guardian approval link:", sendError);
      setError(sendError instanceof Error ? sendError.message : "Could not send the guardian approval link. Please retry.");
    } finally {
      setSendingLink(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="guardian-social-gate-title" className="my-auto w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldAlert className="h-6 w-6" />
        </div>
        {!access.guardian_consent ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Parent or guardian approval</p>
            <h2 id="guardian-social-gate-title" className="mt-2 text-2xl font-bold">Social features need verified approval</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              A parent or guardian must verify their email before {featureName} can be enabled. Your learning tools remain available while this is pending.
            </p>
            {!access.guardian_email ? (
              <form onSubmit={saveGuardianEmail} className="mt-5 space-y-3">
                <label htmlFor="guardian-email-gate" className="text-sm font-medium">Parent or guardian email</label>
                <Input id="guardian-email-gate" type="email" autoComplete="email" value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} required placeholder="Parent or guardian email" />
                <Button className="w-full" type="submit" disabled={savingEmail || !guardianEmail.trim()}>{savingEmail ? "Saving…" : "Save guardian email"}</Button>
              </form>
            ) : (
              <div className="mt-5 rounded-xl border bg-muted/40 p-3 text-sm">
                Approval link will be sent to <span className="font-semibold">{access.guardian_email}</span>.
              </div>
            )}
            {access.guardian_email && (
              <Button className="mt-4 w-full" onClick={() => void sendApprovalLink()} disabled={sendingLink}>
                <MailCheck className="mr-2 h-4 w-4" />
                {sendingLink ? "Sending approval link…" : "Send guardian approval link"}
              </Button>
            )}
            {linkSent && (
              <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                A secure sign-in and approval link has been sent. Your guardian must open it and approve the request. All social controls stay off until they choose what to allow.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Guardian controls</p>
            <h2 id="guardian-social-gate-title" className="mt-2 text-2xl font-bold">This feature is currently turned off</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Your parent or guardian has not enabled {featureName}. Ask them to review your settings on the{" "}
              <Link to="/guardian-controls" className="font-medium text-primary underline underline-offset-4">Guardian Controls page</Link>.
            </p>
          </>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/")}>Return home</Button>
        </div>
      </section>
    </div>
  );
};

export default GuardianSocialAccessGate;
