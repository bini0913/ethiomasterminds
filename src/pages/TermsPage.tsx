import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const TermsPage: React.FC = () => (
  <main className="min-h-screen bg-background px-4 py-8 text-foreground">
    <article className="mx-auto max-w-4xl space-y-7">
      <Button asChild variant="ghost" size="sm">
        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to Master Minds</Link>
      </Button>
      <header className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpenCheck className="h-6 w-6" /></div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Minds · Terms</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Use</h1>
        <p className="text-sm text-muted-foreground">Effective date: November 24, 2026 · Version 1.0</p>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">These terms explain the basic rules for using Master Minds, its learning tools, school portals, and optional social features.</p>
      </header>

      <Card><CardContent className="space-y-2 p-5">
        <h2 className="text-lg font-semibold">Who provides the service?</h2>
        <p className="text-sm leading-7 text-muted-foreground">Master Minds is published by Masterminds Support Team. Questions about these terms can be sent to <a className="font-medium text-primary underline underline-offset-4" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>.</p>
      </CardContent></Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Accounts and accurate information</h2>
        <p className="text-sm leading-7 text-muted-foreground">Use accurate account information and keep your sign-in details secure. Do not impersonate another person, share your password, or use another person's account without permission. You are responsible for activity carried out through your account, subject to applicable law and guardian or school controls.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Learners under 18</h2>
        <p className="text-sm leading-7 text-muted-foreground">Master Minds serves learners from kindergarten through Grade 12. For learner accounts under 18, social and communication features require a parent or legal guardian to verify their email and confirm that they are an adult guardian. Each feature remains off until the guardian enables it. A guardian can change or revoke these settings at any time.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Learning tools and AI responses</h2>
        <p className="text-sm leading-7 text-muted-foreground">Master Minds provides study tools, practice questions, learning analytics, and AI-assisted features. AI-generated explanations, questions, plans, and insights may contain mistakes or omissions. Check important academic information against your textbooks, official materials, or teacher. Do not rely on AI output as the only source for an important school or exam decision.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Community and user content</h2>
        <p className="text-sm leading-7 text-muted-foreground">You are responsible for content you post, upload, or send. Do not post or send bullying, harassment, threats, hateful content, sexual content, private personal information, impersonation, spam, malware, or material that violates another person's rights or applicable law. Do not use social or multiplayer features to pressure, deceive, or target another learner.</p>
        <p className="text-sm leading-7 text-muted-foreground">Use report and block tools when something is unsafe or unwanted. Authorized moderators may review reports, remove content, restrict features, or suspend accounts when necessary to protect users or enforce these terms.</p>
        <p className="text-sm leading-7 text-muted-foreground"><Link to="/community-guidelines" className="font-medium text-primary underline underline-offset-4">Read the Community Guidelines</Link>.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. School and family accounts</h2>
        <p className="text-sm leading-7 text-muted-foreground">If your account is connected to a school, authorized school staff may manage school-related records and access information needed for teaching, administration, or school operations. Parent or guardian access is limited to the family features and records made available to that linked account. School, financial, and audit records may be retained where required for legitimate school or legal purposes.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Respect intellectual property</h2>
        <p className="text-sm leading-7 text-muted-foreground">Do not upload or distribute textbooks, exam papers, images, or other material unless you have permission or another lawful basis to use it. Master Minds and its licensors retain rights in the app, branding, software, and original service content. You keep rights you already hold in content you create, while giving Master Minds permission to host and display it only as needed to provide the features you choose and enforce these terms.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Safety, restrictions, and availability</h2>
        <p className="text-sm leading-7 text-muted-foreground">We may limit or suspend access to content or accounts that violate these terms, create safety risks, or threaten service security. We aim to keep Master Minds available and reliable, but features may change, be interrupted, or become unavailable for maintenance, security, or operational reasons.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Account deletion</h2>
        <p className="text-sm leading-7 text-muted-foreground">You can request account deletion in Settings or through the <Link to="/delete-account" className="font-medium text-primary underline underline-offset-4">external deletion page</Link>. We verify requests and review school memberships, shared content, financial records, and audit obligations before completing deletion. Some records may be retained or de-identified where necessary; school invoices and financial audit records are not removed through the standard learner-account deletion process.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Privacy</h2>
        <p className="text-sm leading-7 text-muted-foreground">Our <Link to="/privacy-policy" className="font-medium text-primary underline underline-offset-4">Privacy Policy</Link> explains what information is processed, why it is used, which service providers help operate Master Minds, and how to request deletion.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">10. Changes and contact</h2>
        <p className="text-sm leading-7 text-muted-foreground">We may update these terms when the service changes. The latest version and effective date will be posted on this page. If you have a question or concern, contact Masterminds Support Team at <a className="font-medium text-primary underline underline-offset-4" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>.</p>
      </section>

      <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-sm text-muted-foreground">
        <Link to="/privacy-policy" className="underline underline-offset-4">Privacy Policy</Link>
        <Link to="/community-guidelines" className="underline underline-offset-4">Community Guidelines</Link>
        <Link to="/delete-account" className="underline underline-offset-4">Delete account</Link>
      </footer>
    </article>
  </main>
);

export default TermsPage;
