import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type GuardianRequest = {
  request_id: string;
  child_name: string;
  child_username: string;
  child_grade: string | null;
  child_age: number | null;
  requested_at: string;
};

const GuardianConsentPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestId = params.get("request");
  const [request, setRequest] = useState<GuardianRequest | null>(null);
  const [attested, setAttested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!requestId || !user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error: requestError } = await (supabase as any).rpc("get_guardian_consent_request", {
        p_request_id: requestId,
      });
      if (!active) return;
      if (requestError) {
        setError(requestError.message || "This approval link could not be verified.");
        setRequest(null);
      } else {
        setRequest(Array.isArray(data) ? data[0] || null : data || null);
        setError(null);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [requestId, user?.id]);

  const respond = async (approve: boolean) => {
    if (!requestId || !attested && approve || saving) return;
    setSaving(true);
    const { error: responseError } = await (supabase as any).rpc(
      approve ? "approve_guardian_consent" : "reject_guardian_consent",
      approve ? { p_request_id: requestId, p_parent_attestation: true } : { p_request_id: requestId },
    );
    setSaving(false);
    if (responseError) {
      toast.error(responseError.message || "Your response could not be saved.");
      return;
    }
    toast.success(approve ? "Guardian approval recorded. Parent controls are ready." : "The request was declined.");
    if (approve) navigate("/guardian-controls", { replace: true });
    else navigate("/", { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="mt-3 text-2xl">Parent or guardian approval</CardTitle>
          <CardDescription>Review the learner account and decide whether to approve community features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!user && <div className="rounded-lg border p-4 text-sm text-muted-foreground">Open this link after signing in with the parent or guardian email that received it. <Link className="text-primary underline" to="/">Go to sign in</Link>.</div>}
          {loading && <p className="text-sm text-muted-foreground">Verifying the approval request…</p>}
          {!loading && error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}<p className="mt-2 text-muted-foreground">Use the email link sent to the guardian address, and make sure the signed-in account has a verified email and Parent role.</p></div>}
          {!loading && request && (
            <>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Learner account</p>
                <p className="mt-2 text-lg font-semibold">{request.child_name}</p>
                <p className="text-sm text-muted-foreground">@{request.child_username}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {request.child_grade && <span className="rounded-full bg-muted px-2 py-1">{request.child_grade}</span>}
                  {request.child_age != null && <span className="rounded-full bg-muted px-2 py-1">Age {request.child_age}</span>}
                  <span className="rounded-full bg-muted px-2 py-1">Requested {new Date(request.requested_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm leading-6">Lessons, quizzes, textbooks, study tools, and academic progress remain available without this approval. Approval creates your verified parent link and opens the community controls. From there, you can enable friend requests, messaging, multiplayer, and Study Mode calls together or manage each separately. Public profile visibility always remains a separate choice.</p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6">
                  <Checkbox checked={attested} onCheckedChange={(value) => setAttested(value === true)} />
                  <span>I confirm that I am this learner’s parent or legal guardian, I am at least 18 years old, and I approve the learner’s use of the Master Minds community features subject to the controls I choose.</span>
                </label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" disabled={!attested || saving} onClick={() => void respond(true)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button className="flex-1" variant="outline" disabled={saving} onClick={() => void respond(false)}>
                  <XCircle className="mr-2 h-4 w-4" /> Decline
                </Button>
              </div>
            </>
          )}
          <p className="text-center text-xs text-muted-foreground">Support: mindm1517@gmail.com · <Link className="underline" to="/privacy">Privacy Policy</Link></p>
        </CardContent>
      </Card>
    </main>
  );
};

export default GuardianConsentPage;
