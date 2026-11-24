import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SUPPORT_EMAIL = "mindm1517@gmail.com";

const DeleteAccountRequest: React.FC = () => {
  const [accountEmail, setAccountEmail] = useState("");
  const [username, setUsername] = useState("");
  const [details, setDetails] = useState("");

  const submitRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = encodeURIComponent("Master Minds account and data deletion request");
    const body = encodeURIComponent([
      "I am requesting deletion of my Master Minds account and associated personal data.",
      "",
      `Account email: ${accountEmail.trim()}`,
      `Username (if known): ${username.trim() || "Not provided"}`,
      "",
      "Additional details:",
      details.trim() || "None",
      "",
      "I understand that Master Minds may contact me to verify account ownership and explain any records that must be retained for legitimate school, financial, security or legal reasons.",
      "",
      "I have not included my password."
    ].join("\n"));
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
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
          <p className="mt-3 text-base leading-7 text-muted-foreground">You can request deletion even if you no longer have the app installed. This page is the external deletion-request route for Master Minds.</p>
        </header>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Send a deletion request</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the email address associated with the account. We will use it to locate the account and may ask for reasonable verification before processing the request. Do not send your password, verification codes or identity documents in an ordinary email.</p>
          <form onSubmit={submitRequest} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deletion-email">Account email address</Label>
              <Input id="deletion-email" type="email" autoComplete="email" required value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="The email used for your Master Minds account" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletion-username">Username (optional)</Label>
              <Input id="deletion-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your Master Minds username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletion-details">Additional details (optional)</Label>
              <Textarea id="deletion-details" value={details} onChange={(event) => setDetails(event.target.value)} rows={3} placeholder="Anything that may help us identify the account. Do not include passwords or private documents." />
            </div>
            <Button type="submit" className="w-full sm:w-auto"><Mail className="mr-2 h-4 w-4" /> Open email request</Button>
          </form>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">This opens your email application; you must send the prepared message for the request to reach us. If no email application opens, email <a className="font-medium text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the subject “Master Minds account and data deletion request”.</p>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h2 className="font-semibold">What happens next</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
                <li>The support team verifies that the request is from the account owner or an authorised parent or guardian.</li>
                <li>We review connected learning, social, school and storage records before deletion so that one account's removal does not damage another person's records.</li>
                <li>We delete or de-identify eligible account data. Certain school, financial, security or legal records may be retained where there is a legitimate requirement; any such retention should be limited and access-restricted.</li>
                <li>We may contact you if verification or a school-record handover is needed before completion.</li>
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
