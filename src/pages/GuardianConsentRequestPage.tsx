import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import GuardianSocialAccessGate from "@/components/social/GuardianSocialAccessGate";

type FeatureKey = "allow_direct_messages" | "allow_study_calls";

const GuardianConsentRequestPage: React.FC = () => {
  const [params] = useSearchParams();
  const requested = params.get("feature");
  const feature: FeatureKey = requested === "allow_direct_messages" ? "allow_direct_messages" : "allow_study_calls";

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-5">
          <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to Master Minds</Link>
        </Button>
        <div className="rounded-xl border bg-card p-5">
          <h1 className="text-xl font-semibold">Guardian approval request</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verify parent or guardian approval for a specific communication feature. Approval does not automatically enable any feature; the guardian chooses each control separately.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">If your guardian has already approved, they can change the setting from Guardian Controls.</p>
        </div>
        <GuardianSocialAccessGate featureOverride={feature} />
      </div>
    </main>
  );
};

export default GuardianConsentRequestPage;
