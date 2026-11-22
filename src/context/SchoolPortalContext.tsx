import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";

// "admin" is retained only to read and migrate legacy memberships; new assignments are blocked.
export type SchoolRole = "manager" | "admin" | "teacher" | "finance" | "parent" | "student";

export type SchoolMembership = {
  id: string;
  school_id: string;
  user_id: string;
  school_role: SchoolRole;
  status: string;
  grade_label: string | null;
  section_id: string | null;
  student_number: number | null;
  school_username: string | null;
  age_at_enrollment: number | null;
  question_submission_suspended: boolean;
  question_submission_suspension_reason: string | null;
  created_at: string;
  school: {
    id: string;
    name: string;
    school_code: string;
  };
};

type SchoolPortalContextValue = {
  memberships: SchoolMembership[];
  activeMembership: SchoolMembership | null;
  activeSchool: SchoolMembership["school"] | null;
  loading: boolean;
  error: string | null;
  switchSchool: (membershipId: string) => void;
  refresh: () => Promise<void>;
};

const SchoolPortalContext = createContext<SchoolPortalContextValue | null>(null);

export function SchoolPortalProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [activeMembershipId, setActiveMembershipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setMemberships([]);
      setActiveMembershipId(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const db = supabase as any;
    const { data: membershipRows, error: membershipError } = await db
      .from("school_memberships")
      .select("id,school_id,user_id,school_role,status,grade_label,section_id,student_number,school_username,age_at_enrollment,question_submission_suspended,question_submission_suspension_reason,created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (membershipError) {
      setMemberships([]);
      setActiveMembershipId(null);
      setError("School information could not be loaded.");
      setLoading(false);
      return;
    }

    const rows = (membershipRows ?? []) as Omit<SchoolMembership, "school">[];
    if (!rows.length) {
      setMemberships([]);
      setActiveMembershipId(null);
      setLoading(false);
      return;
    }

    const schoolIds = [...new Set(rows.map((row) => row.school_id))];
    const { data: schoolRows, error: schoolError } = await db
      .from("schools")
      .select("id,name,school_code")
      .in("id", schoolIds);

    if (schoolError) {
      setMemberships([]);
      setActiveMembershipId(null);
      setError("School details could not be loaded.");
      setLoading(false);
      return;
    }

    const schoolMap = new Map((schoolRows ?? []).map((school: SchoolMembership["school"]) => [school.id, school]));
    const nextMemberships = rows
      .map((row) => {
        const school = schoolMap.get(row.school_id);
        return school ? ({ ...row, school } as SchoolMembership) : null;
      })
      .filter((row): row is SchoolMembership => Boolean(row));

    setMemberships(nextMemberships);
    setActiveMembershipId((current) => {
      if (current && nextMemberships.some((membership) => membership.id === current)) return current;
      return nextMemberships.find((membership) => membership.school_role === user.role)?.id
        ?? nextMemberships[0]?.id
        ?? null;
    });
    setLoading(false);
  }, [user?.id, user?.role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.id === activeMembershipId) ?? null,
    [memberships, activeMembershipId],
  );

  const value = useMemo<SchoolPortalContextValue>(() => ({
    memberships,
    activeMembership,
    activeSchool: activeMembership?.school ?? null,
    loading,
    error,
    switchSchool: setActiveMembershipId,
    refresh,
  }), [memberships, activeMembership, loading, error, refresh]);

  return <SchoolPortalContext.Provider value={value}>{children}</SchoolPortalContext.Provider>;
}

export function useSchoolPortal() {
  const context = useContext(SchoolPortalContext);
  if (!context) throw new Error("useSchoolPortal must be used inside SchoolPortalProvider");
  return context;
}
