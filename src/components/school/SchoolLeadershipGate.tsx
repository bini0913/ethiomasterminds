import React, { createContext, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal, type SchoolMembership } from "@/context/SchoolPortalContext";

export type SchoolLeadershipAppointment = {
  id: string;
  school_id: string;
  membership_id: string;
  position: "academic_director" | "hr_director" | "vice_director" | "kg_director" | "elementary_director" | "middle_school_director" | "high_school_director" | "team_leader";
  division_scope: "kg" | "elementary" | "middle_school" | "high_school" | null;
  team_name: string | null;
  permissions: string[];
  status: "active" | "suspended" | "ended";
  start_date: string;
  end_date: string | null;
};

type LeadershipContextValue = {
  appointment: SchoolLeadershipAppointment;
  membership: SchoolMembership;
};

const LeadershipContext = createContext<LeadershipContextValue | null>(null);

export function useSchoolLeadership() {
  const value = useContext(LeadershipContext);
  if (!value) throw new Error("useSchoolLeadership must be used inside SchoolLeadershipGate");
  return value;
}

export default function SchoolLeadershipGate({ children }: { children: React.ReactNode }) {
  const { memberships, activeMembership, loading: membershipsLoading, error: membershipError, switchSchool } = useSchoolPortal();
  const [appointment, setAppointment] = useState<SchoolLeadershipAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const membershipIds = memberships.map((membership) => membership.id);
      if (!membershipIds.length) {
        setAppointment(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const today = new Date().toLocaleDateString("en-CA");
      const { data, error: queryError } = await (supabase as any)
        .from("school_leadership_appointments")
        .select("id,school_id,membership_id,position,division_scope,team_name,permissions,status,start_date,end_date")
        .in("membership_id", membershipIds)
        .eq("status", "active")
        .neq("position", "main_director")
        .lte("start_date", today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order("start_date", { ascending: false });
      if (cancelled) return;
      if (queryError) {
        setError("Your school leadership appointment could not be verified. Please try again or contact the School Manager.");
        setAppointment(null);
      } else {
        const activeAppointments = (data ?? []) as SchoolLeadershipAppointment[];
        const selected = activeAppointments.find((item) => item.membership_id === activeMembership?.id)
          ?? activeAppointments[0]
          ?? null;
        setAppointment(selected);
        if (selected && selected.membership_id !== activeMembership?.id) {
          switchSchool(selected.membership_id);
        }
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [memberships, activeMembership?.id, switchSchool]);

  if (membershipsLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-5"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" /><p className="mt-3 text-sm text-slate-500">Verifying school leadership access…</p></div></div>;
  }
  if (membershipError || error) {
    return <div className="mx-auto mt-10 max-w-xl rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700">{error || membershipError}</div>;
  }
  const appointmentMembership = memberships.find((membership) => membership.id === appointment?.membership_id) ?? activeMembership;
  if (!appointmentMembership) return <Navigate to="/" replace />;
  if (!appointment) {
    return <div className="mx-auto mt-10 max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-lg font-semibold text-slate-900">No active leadership appointment</h1><p className="mt-2 text-sm leading-6 text-slate-600">This school account has not been appointed to a leadership position, or its appointment has ended. Contact your School Manager to assign or renew your school leadership appointment.</p><p className="mt-3 text-xs text-slate-500">Your existing school membership and personal account have not been changed.</p></div>;
  }

  return <LeadershipContext.Provider value={{ appointment, membership: appointmentMembership }}>{children}</LeadershipContext.Provider>;
}
