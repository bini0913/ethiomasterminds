import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { SchoolRole, useSchoolPortal } from "@/context/SchoolPortalContext";

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
  const matchingMembership = memberships.find((membership) => membership.school_role === role) ?? null;

  useEffect(() => {
    if (matchingMembership && activeMembership?.id !== matchingMembership.id) {
      switchSchool(matchingMembership.id);
    }
  }, [matchingMembership?.id, activeMembership?.id, switchSchool]);

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

  if (!matchingMembership) return <>{fallback ?? <Navigate to="/" replace />}</>;
  if (activeMembership?.id !== matchingMembership.id) return null;

  return <>{children}</>;
}
