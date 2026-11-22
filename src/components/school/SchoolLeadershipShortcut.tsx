import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";

export default function SchoolLeadershipShortcut() {
  const { activeMembership } = useSchoolPortal();
  const [appointed, setAppointed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!activeMembership?.id) {
        setAppointed(false);
        return;
      }
      const today = new Date().toLocaleDateString("en-CA");
      const { data, error } = await (supabase as any)
        .from("school_leadership_appointments")
        .select("id")
        .eq("membership_id", activeMembership.id)
        .eq("status", "active")
        .lte("start_date", today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .maybeSingle();
      if (!cancelled) setAppointed(!error && Boolean(data?.id));
    };
    void check();
    return () => { cancelled = true; };
  }, [activeMembership?.id]);

  if (!appointed) return null;
  return (
    <Link to="/school/admin" className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100">
      <ShieldCheck className="h-4 w-4" />
      Leadership workspace
    </Link>
  );
}
