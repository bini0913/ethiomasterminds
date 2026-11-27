import React, { useEffect, useState } from "react";
import { MailCheck, ShieldCheck, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GuardianApprovalCard: React.FC = () => {
  const { user, refreshProfile } = useUser();
  const [email, setEmail] = useState(user?.guardianEmail || "");
  const [ageValue, setAgeValue] = useState(user?.age == null ? "" : String(user.age));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setEmail(user?.guardianEmail || "");
    setAgeValue(user?.age == null ? "" : String(user.age));
  }, [user?.guardianEmail, user?.age]);

  if (!user || user.role !== "student" || (user.age != null && user.age >= 18)) return null;

  const sendApproval = async () => {
    if (sending) return;
    const parsedAge = user.age == null ? Number(ageValue) : user.age;
    if (!Number.isInteger(parsedAge) || parsedAge < 3 || parsedAge > 120) {
      toast.error("Enter a valid age first.");
      return;
    }
    if (parsedAge < 18 && (!email.trim() || email.trim().toLowerCase() === user.email?.toLowerCase())) {
      toast.error("Enter a separate parent or guardian email.");
      return;
    }

    setSending(true);
    let requestId: string | null = null;
    if (user.age == null) {
      const { data, error } = await (supabase as any).rpc("set_my_age_and_guardian", {
        p_age: parsedAge,
        p_guardian_email: parsedAge < 18 ? email.trim().toLowerCase() : null,
      });
      if (error) {
        setSending(false);
        toast.error(error.message || "Age and guardian details could not be saved.");
        return;
      }
      requestId = data || null;
    } else {
      const { data, error } = await (supabase as any).rpc("create_guardian_consent_request", {
        p_guardian_email: email.trim().toLowerCase(),
      });
      if (error || !data) {
        setSending(false);
        toast.error(error?.message || "Guardian request could not be created.");
        return;
      }
      requestId = data;
    }

    if (parsedAge >= 18) {
      setSending(false);
      await refreshProfile();
      toast.success("Your age information has been saved.");
      return;
    }

    const { error: inviteError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/guardian-consent?request=${requestId}`,
        shouldCreateUser: true,
        data: { account_type: "individual_parent", name: "Parent or Guardian" },
      },
    });
    setSending(false);
    if (inviteError) {
      toast.error("The request was saved, but the approval email could not be sent. Please try again or contact support.");
      await refreshProfile();
      return;
    }
    await refreshProfile();
    toast.success("A guardian approval link has been sent.");
  };

  const verified = user.guardianConsentStatus === "verified";
  const needsAge = user.age == null;
  const enteredAge = Number(ageValue);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Parent or guardian approval</CardTitle>
        <CardDescription>Learning tools remain available. A verified parent or legal guardian manages community access, including friends, messaging, multiplayer, and Study Mode calls.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {verified ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-medium">Guardian approval verified</p><p className="mt-1 text-emerald-800">Your parent or guardian manages which community features are enabled.</p></div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{needsAge ? "Your age information is missing. Complete it to apply the correct safety settings; community features remain off until then." : user.guardianConsentStatus === "rejected" ? "The previous request was declined. You can send a new request." : "Approval is pending. Lessons, quizzes, textbooks, and study tools remain available; community features stay off until a verified guardian chooses to enable them."}</p>
            </div>
            {needsAge && (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="learner-age">Your age</label>
                <Input id="learner-age" type="number" min="3" max="120" inputMode="numeric" value={ageValue} onChange={(event) => setAgeValue(event.target.value)} placeholder="Age" />
              </div>
            )}
            {(needsAge ? Number.isInteger(enteredAge) && enteredAge >= 3 && enteredAge < 18 : true) && (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="guardian-email">Parent or guardian email</label>
                <Input id="guardian-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="parent@example.com" autoComplete="off" />
              </div>
            )}
            <Button onClick={() => void sendApproval()} disabled={sending || (needsAge ? !ageValue.trim() : false) || (needsAge && enteredAge < 18 && !email.trim()) || (!needsAge && !email.trim())}>{sending ? "Saving and sending…" : needsAge && enteredAge >= 18 ? "Save age" : "Send or resend approval link"}</Button>
          </>
        )}
        <p className="text-xs text-muted-foreground">Never enter your parent’s password or a verification code here. Support: mindm1517@gmail.com</p>
      </CardContent>
    </Card>
  );
};

export default GuardianApprovalCard;
