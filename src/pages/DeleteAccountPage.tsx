import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DeletionRequest = {
  id: string;
  status: "pending_review" | "needs_handover" | "approved" | "rejected" | "cancelled" | "completed";
  requested_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
  review_note: string | null;
};

const statusLabels: Record<DeletionRequest["status"], string> = {
  pending_review: "Pending review",
  needs_handover: "Needs school or records handover",
  approved: "Approved for deletion",
  rejected: "Not approved",
  cancelled: "Cancelled",
  completed: "Completed",
};

const DeleteAccountPage: React.FC = () => {
  const { user } = useUser();
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);

  const loadRequest = useCallback(async () => {
    if (!user?.id) {
      setRequest(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_my_account_deletion_request");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setRequest(row || null);
    } catch (error) {
      console.error("Could not load account deletion request:", error);
      toast.error("Could not load your request status. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  const sendSignInLink = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setSendingLink(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/delete-account`,
        },
      });
      if (error) throw error;
      setLinkSent(true);
    } catch (error) {
      console.error("Could not send deletion sign-in link:", error);
      // Keep the response generic so the page does not reveal whether an account exists.
      setLinkSent(true);
    } finally {
      setSendingLink(false);
    }
  };

  const submitRequest = async () => {
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("request_my_account_deletion");
      if (error) throw error;
      toast.success("Your account deletion request has been submitted.");
      await loadRequest();
    } catch (error) {
      console.error("Could not submit account deletion request:", error);
      toast.error("We could not submit the request. Please try again or contact support.");
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("cancel_my_account_deletion_request");
      if (error) throw error;
      if (!data) {
        toast.error("This request can no longer be cancelled online.");
      } else {
        toast.success("Your deletion request has been cancelled.");
      }
      await loadRequest();
    } catch (error) {
      console.error("Could not cancel account deletion request:", error);
      toast.error("Could not cancel the request. Please contact support.");
    } finally {
      setLoading(false);
    }
  };

  const canRequestAgain = !request || request.status === "rejected" || request.status === "cancelled";
  const canCancel = request?.status === "pending_review" || request?.status === "needs_handover";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Master Minds
          </Link>
        </Button>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Request account deletion</CardTitle>
            <p className="text-sm text-muted-foreground">
              This page is available outside the installed app. Sign in with the account you want deleted, then submit a request.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {!user?.id ? (
              <form onSubmit={sendSignInLink} className="space-y-3">
                <label htmlFor="deletion-email" className="text-sm font-medium">Account email</label>
                <Input
                  id="deletion-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter the email on your Master Minds account"
                  required
                />
                <Button type="submit" disabled={sendingLink || !email.trim()} className="w-full">
                  <MailCheck className="mr-2 h-4 w-4" />
                  {sendingLink ? "Sending sign-in link…" : "Send secure sign-in link"}
                </Button>
                {linkSent && (
                  <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    If this email belongs to a Master Minds account, a secure sign-in link will be sent. Open it on this device to continue. This page does not create a new account.
                  </p>
                )}
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  Signed in as <span className="font-medium">{user.username || "your Master Minds account"}</span>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading request status…</p>
                ) : request ? (
                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">Your latest request</p>
                      <Badge variant={request.status === "needs_handover" ? "destructive" : "outline"}>
                        {statusLabels[request.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Submitted {new Date(request.requested_at).toLocaleString()}</p>
                    {request.review_note && <p className="text-sm text-muted-foreground">{request.review_note}</p>}
                    {canCancel && (
                      <Button variant="outline" size="sm" disabled={loading} onClick={() => void cancelRequest()}>
                        Cancel request
                      </Button>
                    )}
                    {canRequestAgain && (
                      <Button className="w-full" disabled={loading} onClick={() => void submitRequest()}>
                        Submit a new deletion request
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button className="w-full" disabled={loading} onClick={() => void submitRequest()}>
                    {loading ? "Submitting…" : "Submit account deletion request"}
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                What happens next
              </div>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>We review the request and verify that it belongs to the account owner.</li>
                <li>School memberships, student records, parent links, shared learning content, financial records, and audit history may need transfer or lawful retention before deletion can finish.</li>
                <li>We do not delete school invoices or financial audit records as part of account deletion.</li>
                <li>When deletion is approved and dependencies are safely handled, personal account data and user-owned files are removed. Required records are retained or anonymized as applicable.</li>
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              Need help? Contact Masterminds Support Team at{" "}
              <a className="font-medium text-primary underline underline-offset-4" href="mailto:mindm1517@gmail.com">
                mindm1517@gmail.com
              </a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default DeleteAccountPage;
