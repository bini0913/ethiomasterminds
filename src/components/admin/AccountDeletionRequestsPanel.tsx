import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DeletionRequestRow = {
  id: string;
  user_id: string | null;
  requester_email: string | null;
  display_name: string | null;
  username: string | null;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  blockers: string[];
};

const AccountDeletionRequestsPanel: React.FC = () => {
  const [requests, setRequests] = useState<DeletionRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("admin_list_account_deletion_requests", { p_limit: 100 });
      if (error) throw error;
      setRequests((data || []) as DeletionRequestRow[]);
    } catch (error) {
      console.error("Could not load account deletion requests:", error);
      toast.error("Could not load account deletion requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const reviewRequest = async (request: DeletionRequestRow, action: "approve" | "needs_handover" | "reject") => {
    setBusyId(request.id);
    try {
      const { data, error } = await (supabase as any).rpc("admin_review_account_deletion_request", {
        p_request_id: request.id,
        p_action: action,
        p_note: null,
      });
      if (error) throw error;
      toast.success(action === "approve"
        ? (data === "approved" ? "Request approved for deletion." : "Request requires handover or retention review.")
        : action === "needs_handover" ? "Request placed on hold for handover." : "Request rejected.");
      await loadRequests();
    } catch (error) {
      console.error("Could not review account deletion request:", error);
      toast.error("Could not update this deletion request.");
    } finally {
      setBusyId(null);
    }
  };

  const completeRequest = async (request: DeletionRequestRow) => {
    if (!window.confirm("Complete this account deletion now? This permanently removes the account and user-owned data after the server verifies that no protected school, financial, parent, or audit records remain.")) {
      return;
    }
    setBusyId(request.id);
    try {
      const { data, error } = await (supabase as any).rpc("admin_complete_account_deletion_request", {
        p_request_id: request.id,
      });
      if (error) throw error;
      if (data === true) {
        toast.success("Account deletion completed. Required records were retained or anonymized.");
      } else {
        toast.warning("Deletion was paused because linked records still require handover or retention review.");
      }
      await loadRequests();
    } catch (error) {
      console.error("Could not complete account deletion:", error);
      toast.error("Could not complete this deletion. Review the linked records before retrying.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="mt-5 border-border/70">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Account deletion requests
            </CardTitle>
            <CardDescription>
              Review ownership, school, parent, finance, and audit dependencies before completing deletion.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadRequests()} disabled={loading}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading requests…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no account deletion requests.</p>
        ) : requests.map((request) => (
          <div key={request.id} className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{request.display_name || request.username || "Account owner"}</p>
                <p className="text-xs text-muted-foreground">{request.requester_email || "Email cleared after completion"}</p>
              </div>
              <Badge variant={request.status === "needs_handover" ? "destructive" : request.status === "approved" ? "default" : "outline"}>
                {request.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Requested {new Date(request.requested_at).toLocaleString()}</p>
            {request.blockers?.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Protected records requiring review
                </p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {request.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              </div>
            )}
            {request.review_note && <p className="text-sm text-muted-foreground">{request.review_note}</p>}
            {request.status === "pending_review" || request.status === "needs_handover" ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void reviewRequest(request, "approve")} disabled={busyId === request.id}>
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  Review and approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => void reviewRequest(request, "needs_handover")} disabled={busyId === request.id}>
                  Needs handover
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void reviewRequest(request, "reject")} disabled={busyId === request.id}>
                  Reject
                </Button>
              </div>
            ) : request.status === "approved" ? (
              <Button size="sm" variant="destructive" onClick={() => void completeRequest(request)} disabled={busyId === request.id || request.blockers?.length > 0}>
                Complete deletion
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AccountDeletionRequestsPanel;
