import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flag, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const CommunityGuidelinesPage: React.FC = () => (
  <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Master Minds
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">Updated 24 November 2026</span>
      </div>

      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Master Minds</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Community Guidelines</h1>
        <p className="mt-3 text-muted-foreground">
          Master Minds is a learning community. These rules apply to profiles, posts, comments, messages,
          group chats, multiplayer chat, study rooms, and other features where members interact.
        </p>
      </div>

      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Treat people with respect</h2>
          <p className="text-muted-foreground">Be kind and constructive. Harassment, bullying, threats, humiliation, hate, discrimination, impersonation, and repeated unwanted contact are not allowed.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Keep the community safe for students</h2>
          <p className="text-muted-foreground">Any attempt to exploit, groom, manipulate, threaten, or endanger a child is strictly prohibited. Do not request, create, upload, or share sexual content involving anyone under 18. Do not pressure another member to share private images, personal information, or to move a conversation to an outside service.</p>
          <p className="text-muted-foreground">Do not use Master Minds to arrange unsafe meetings, solicit personal contact details, or make another member feel pressured or unsafe.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Protect personal information</h2>
          <p className="text-muted-foreground">Do not publish passwords, home addresses, phone numbers, school timetables, private account details, or another person's personal information. Share only what is necessary for learning and only with people you know and trust.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Keep content appropriate and learning-focused</h2>
          <p className="text-muted-foreground">Do not post sexual or exploitative content, graphic violence, threats, illegal material, scams, spam, malware, or content that encourages dangerous behavior. Do not use posts, comments, or chats to cheat, deceive, or disrupt another learner.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Use report and block tools</h2>
          <div className="flex items-start gap-3 rounded-xl border p-4">
            <Flag className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Report content or a user</p>
              <p className="text-sm text-muted-foreground">Use the in-app Report action when a post, comment, message, or account breaks these rules. Include enough context for a reviewer to understand the concern.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border p-4">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Block unwanted contact</p>
              <p className="text-sm text-muted-foreground">Use Block in a conversation. You can review or unblock accounts later in Settings → Privacy → Blocked users.</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. How reports are handled</h2>
          <p className="text-muted-foreground">Reports are reviewed by the Master Minds moderation team. Depending on the report and available evidence, action may include removing content, restricting social features, suspending an account, or referring an urgent safety matter to an appropriate authority where required. Submitting a report does not guarantee a particular outcome.</p>
          <p className="text-muted-foreground">For a safety concern or to ask for a review, contact <a className="font-medium text-primary underline underline-offset-4" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Child safety contact</h2>
          <p className="text-muted-foreground">Master Minds Support Team is the current support contact for child-safety concerns: <a className="font-medium text-primary underline underline-offset-4" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Enforcement</h2>
          <p className="text-muted-foreground">We may remove content, limit access to communication features, suspend accounts, or permanently close accounts when we determine that these rules or applicable platform requirements have been violated. Serious safety reports receive priority review.</p>
        </section>
      </div>

      <div className="mt-12 border-t pt-6 text-sm text-muted-foreground">
        <p>These guidelines are part of the Master Minds user policy. The current version is 2026-11-24-v1.</p>
        <p className="mt-2">Questions: <a className="text-primary underline underline-offset-4" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a></p>
      </div>
    </div>
  </main>
);

export default CommunityGuidelinesPage;
