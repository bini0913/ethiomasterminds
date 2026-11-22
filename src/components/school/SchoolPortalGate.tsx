import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { SchoolRole, useSchoolPortal } from "@/context/SchoolPortalContext";
import { supabase } from "@/integrations/supabase/client";

type LeadershipCheck = "idle" | "checking" | "none" | "assigned" | "error";

export default function SchoolPortalGate({
  role,
  children,
  fallback,
}: {
  role: SchoolRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { memberships, activeMembership, loading, error, switchSchool } = useSchoolPortal();
  const [leadershipCheck, setLeadershipCheck] = useState<LeadershipCheck>("idle");
  const matchingMembership = activeMembership?.school_role === role
    ? activeMembership
    : memberships.find((membership) => membership.school_role === role) ?? null;

  useEffect(() => {
    if (matchingMembership && activeMembership?.id !== matchingMembership.id) {
      switchSchool(matchingMembership.id);
    }
  }, [matchingMembership?.id, activeMembership?.id, switchSchool]);

  // A teacher or Finance membership with an active leadership appointment belongs
  // to the single Leadership workspace, not both Leadership and Teacher/Finance.
  useEffect(() => {
    if (loading) return;
    if (role !== "teacher" && role !== "finance") {
      setLeadershipCheck("none");
      return;
    }

    const membershipIds = memberships
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.id);
    if (!membershipIds.length) {
      setLeadershipCheck("none");
      return;
    }

    let cancelled = false;
    const verifyLeadership = async () => {
      setLeadershipCheck("checking");
      const today = new Date().toLocaleDateString("en-CA");
      const { data, error: queryError } = await (supabase as any)
        .from("school_leadership_appointments")
        .select("id")
        .in("membership_id", membershipIds)
        .eq("status", "active")
        .lte("start_date", today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (queryError) {
        setLeadershipCheck("error");
        return;
      }
      setLeadershipCheck(data ? "assigned" : "none");
    };

    void verifyLeadership();
    return () => { cancelled = true; };
  }, [loading, memberships, role]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-5">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          <p className="mt-3 text-sm text-slate-500">Loading school workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if ((role === "teacher" || role === "finance") && leadershipCheck === "assigned") {
    return <Navigate to="/school/admin" replace />;
  }

  if ((role === "teacher" || role === "finance") && leadershipCheck === "error") {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700">
        Your leadership assignment could not be verified. Access is paused until it can be checked. Please refresh or contact the School Manager.
      </div>
    );
  }

  if ((role === "teacher" || role === "finance") && leadershipCheck !== "none") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-5">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          <p className="mt-3 text-sm text-slate-500">Verifying your single school workspace…</p>
        </div>
      </div>
    );
  }

  if (!matchingMembership) return <>{fallback ?? <Navigate to="/" replace />}</>;
  if (activeMembership?.id !== matchingMembership.id) return null;

  return <>{children}</>;
}
