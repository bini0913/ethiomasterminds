import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const SUPPORT_EMAIL = "mindm1517@gmail.com";

const DeleteAccountRequest: React.FC = () => {
  const [accountEmail, setAccountEmail] = useState("");
  const [username, setUsername] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage("");
    setSubmitted(false);

    const { data, error } = await supabase.functions.invoke("public-account-deletion-request", {
      body: {
        email: accountEmail.trim(),
        username: username.trim() || null,
        note: details.trim() || null,
      },
    });

    setSubmitting(false);
    if (error || data?.ok !== true) {
      setErrorMessage(data?.error || error?.message || "We could not submit your request. Please try again later.");
      return;
    }

    setSubmitted(true);
    setAccountEmail("");
    setUsername("");
    setDetails("");
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Master Minds
        </Link>
        <header className="mt-8 border-b border-border pb-6">
          <div className="mb-3 flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /><span className="text-sm font-semibold">Master Minds · Data controls</span></div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Request account deletion</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">You can submit a deletion request here even if you no longer have the app installed. Your request enters the secure review queue.</p>
        </header>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Submit a deletion request</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the email address associated with the account. For privacy, the confirmation will not reveal whether that email matches an account. We may contact you to verify account ownership or, for a learner under 18, the authority of a parent or legal guardian. Never provide a password, one-time code or identity document here.</p>
          <form onSubmit={submitRequest} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deletion-email">Account email address</Label>
              <Input id="deletion-email" type="email" autoComplete="email" required maxLength={254} value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="The email used for your Master Minds account" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletion-username">Username (optional)</Label>
              <Input id="deletion-username" maxLength={40} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your Master Minds username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletion-details">Additional details (optional)</Label>
              <Textarea id="deletion-details" value={details} onChange={(event) => setDetails(event.target.value)} maxLength={500} rows={3} placeholder="Brief context only. Do not include passwords, verification codes or private documents." />
              <p className="text-xs text-muted-foreground">{details.length}/500 characters</p>
            </div>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              <Mail className="mr-2 h-4 w-4" /> {submitting ? "Submitting…" : "Submit deletion request"}
            </Button>
          </form>
          {submitted && (
            <div role="status" className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-foreground">
              If the details match an account, your request has been recorded for review. We may contact you to verify account ownership or guardian authority before processing it.
            </div>
          )}
          {errorMessage && (
            <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errorMessage}</p>
          )}
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Requests are rate-limited to protect this service. If you cannot submit the form, contact <a className="font-medium text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the subject “Master Minds account and data deletion request”.</p>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h2 className="font-semibold">What happens next</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                <li>An authorised reviewer verifies account ownership. Requests concerning a learner under 18 require appropriate parent or legal-guardian verification.</li>
                <li>We review connected learning, social, school and storage records before processing a deletion request.</li>
                <li>Eligible personal data is deleted or de-identified. Limited school, financial, security or legal records may be retained where required, with access restricted.</li>
                <li>Submitting this form does not immediately suspend or delete an account. The request is not complete until the approved review and deletion process is finished.</li>
              </ul>
            </div>
          </div>
        </section>

        <p className="mt-8 text-sm text-muted-foreground">Read the <Link className="text-primary underline" to="/privacy">Privacy Policy</Link>, <Link className="text-primary underline" to="/terms">Terms of Use</Link> and <Link className="text-primary underline" to="/child-safety">Child Safety Standards</Link>. Questions: <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      </div>
    </main>
  );
};

export default DeleteAccountRequest;
