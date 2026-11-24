import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";

const GuardianConsentPage: React.FC = () => {
  const { user } = useUser();
  const [params] = useSearchParams();
  const requestId = params.get("request");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [sent, setSent] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendSignInLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestId || !email.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/guardian-consent?request=${requestId}`,
          data: { account_type: "individual_parent", age: 18, name: "Parent or Guardian" },
        },
      });
      if (authError) throw authError;
      setSent(true);
    } catch (sendError) {
      console.error("Could not send guardian sign-in link:", sendError);
      setError("We could not send the sign-in link. Check the email address and try again.");
    } finally {
      setSending(false);
    }
  };

  const approve = async () => {
    if (!requestId || !user?.id) return;
    setApproving(true);
    setError(null);
    try {
      const { error: approvalError } = await (supabase as any).rpc("approve_guardian_consent", {
        p_request_id: requestId,
      });
      if (approvalError) throw approvalError;
      setApproved(true);
    } catch (approvalError) {
      console.error("Guardian approval failed:", approvalError);
      setError(approvalError instanceof Error ? approvalError.message : "This approval link may have expired or the signed-in email may not match.");
    } finally {
      setApproving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-xl">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {approved ? <CheckCircle2 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <CardTitle className="text-2xl">
              {approved ? "Guardian approval verified" : "Parent or guardian approval"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {approved
                ? "You have verified your email and approved this learner's request. Social features remain off until you choose which controls to enable."
                : "A learner has asked this email address to verify parent or guardian approval for selected social features in Master Minds."}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {!requestId ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">This approval link is missing its request reference. Ask the learner to send a new link.</p>
            ) : approved ? (
              <Button asChild className="w-full">
                <Link to="/guardian-controls">Review guardian controls</Link>
              </Button>
            ) : user?.id ? (
              <>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  Signed in as <span className="font-semibold">{user.username || "your Master Minds account"}</span>. Approval can only be completed if this account's verified email matches the address that received the request and belongs to an adult.
                </div>
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  All social controls start turned off. You can enable or revoke individual features at any time from Guardian Controls.
                </div>
                <Button className="w-full" onClick={() => void approve()} disabled={approving}>
                  {approving ? "Verifying approval…" : "Approve as parent or guardian"}
                </Button>
              </>
            ) : (
              <form onSubmit={sendSignInLink} className="space-y-3">
                <label htmlFor="guardian-signin-email" className="text-sm font-medium">Guardian email address</label>
                <Input id="guardian-signin-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="The email that received the request" />
                <Button type="submit" className="w-full" disabled={sending || !email.trim()}>
                  <MailCheck className="mr-2 h-4 w-4" />
                  {sending ? "Sending secure sign-in link…" : "Verify email and continue"}
                </Button>
                {sent && <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">If the request is valid, a secure sign-in link has been sent. Open it to return here and approve.</p>}
              </form>
            )}
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Need help? Masterminds Support Team · <a className="underline underline-offset-4" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default GuardianConsentPage;
