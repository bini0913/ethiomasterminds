import { useUser } from "@/context/UserContext";
import UpperTierHome from "@/components/dashboard/UpperTierHome";
import StudentDashboard from "@/pages/StudentDashboard";
import { getUserTier } from "@/lib/getUserTier";

/** Keeps the Grade 9–12 home separate without changing the shared lower-tier dashboard. */
export default function StudentDashboardRoute() {
  const { user } = useUser();

  if (user?.role === "student" && getUserTier(user.grade) === "upper") {
    return <UpperTierHome />;
  }

  return <StudentDashboard />;
}
