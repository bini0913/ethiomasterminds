import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import GuardianSocialAccessGate from "@/components/social/GuardianSocialAccessGate";

const POLICY_KEY = "community_guidelines";
const POLICY_VERSION = "2026-11-24-v1";
const UGC_ROUTES = [
  "/friends",
  "/profile",
  "/chat",
  "/social",
  "/social/community",
  "/multiplayer",
  "/lobby",
  "/study-mode",
  "/tournaments",
];

type GateStatus = "idle" | "checking" | "required" | "accepted" | "error";

const CommunityGuidelinesGate: React.FC = () => {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<GateStatus>("idle");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const needsAcceptance = Boolean(
    user?.id &&
    UGC_ROUTES.some((route) => location.pathname === route || location.pathname.startsWith(`${route}/`))
  );

  useEffect(() => {
    let active = true;
    if (!needsAcceptance || !user?.id) {
      setStatus("idle");
      return () => { active = false; };
    }

    setStatus("checking");
    void (supabase as any)
      .from("user_policy_acceptances")
      .select("accepted_at")
      .eq("user_id", user.id)
      .eq("policy_key", POLICY_KEY)
      .eq("policy_version", POLICY_VERSION)
      .maybeSingle()
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!active) return;
        if (error) {
          console.error("Could not verify community guidelines acceptance:", error);
          setStatus("error");
        } else {
          setStatus(data ? "accepted" : "required");
        }
      });

    return () => { active = false; };
  }, [needsAcceptance, user?.id, retryCount]);

  const acceptGuidelines = async () => {
    if (!user?.id || !confirmed) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("user_policy_acceptances").insert({
        user_id: user.id,
        policy_key: POLICY_KEY,
        policy_version: POLICY_VERSION,
      });
      if (error && error.code !== "23505") throw error;
      setStatus("accepted");
    } catch (error) {
      console.error("Could not save community guidelines acceptance:", error);
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!needsAcceptance || status === "idle") return null;
  if (status === "accepted") return <GuardianSocialAccessGate />;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4" role="presentation">
      <section
        aria-labelledby="community-guidelines-gate-title"
        aria-modal="true"
        role="dialog"
        className="my-auto w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {status === "error" ? <AlertCircle className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>

        {status === "checking" ? (
          <>
            <h2 id="community-guidelines-gate-title" className="text-xl font-semibold">Checking community rules</h2>
            <p className="mt-2 text-sm text-muted-foreground">Please wait while Master Minds verifies your current policy acceptance.</p>
          </>
        ) : status === "error" ? (
          <>
            <h2 id="community-guidelines-gate-title" className="text-xl font-semibold">Could not verify your acceptance</h2>
            <p className="mt-2 text-sm text-muted-foreground">Social features stay locked until the current policy status can be checked. Please retry when your connection is available.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => setRetryCount((count) => count + 1)}>Retry</Button>
              <Button variant="outline" onClick={() => navigate("/")}>Return home</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Before you continue</p>
            <h2 id="community-guidelines-gate-title" className="mt-2 text-2xl font-bold">Keep Master Minds safe and respectful</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Before posting, commenting, chatting, or joining interactive social features, please review the
              Community Guidelines. They explain respectful behavior, privacy, reporting, blocking, and child safety.
            </p>
            <Link to="/community-guidelines" className="mt-4 inline-flex text-sm font-medium text-primary underline underline-offset-4">
              Read the Master Minds Community Guidelines
            </Link>
            <div className="mt-6 flex items-start gap-3 rounded-xl border p-4">
              <Checkbox id="community-guidelines-confirm" checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />
              <label htmlFor="community-guidelines-confirm" className="cursor-pointer text-sm leading-5">
                I have read and agree to follow the Master Minds Community Guidelines.
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>Not now</Button>
              <Button onClick={() => void acceptGuidelines()} disabled={!confirmed || submitting}>
                {submitting ? "Saving…" : "Accept and continue"}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default CommunityGuidelinesGate;
