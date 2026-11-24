import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PrivacyPolicyPage: React.FC = () => (
  <main className="min-h-screen bg-background px-4 py-8 text-foreground">
    <article className="mx-auto max-w-4xl space-y-7">
      <Button asChild variant="ghost" size="sm">
        <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to Master Minds</Link>
      </Button>

      <header className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6" /></div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Minds · Privacy</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Effective date: November 24, 2026 · Version 1.0</p>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          This policy explains what information Master Minds uses, why it is used, which service providers help operate the app, and how learners and guardians can request changes or deletion.
        </p>
      </header>

      <Card><CardContent className="space-y-3 p-5">
        <h2 className="text-lg font-semibold">Who operates Master Minds?</h2>
        <p className="text-sm leading-7 text-muted-foreground">Master Minds is published by Masterminds Support Team. For privacy questions, access requests, or account deletion help, contact <a className="font-medium text-primary underline underline-offset-4" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>.</p>
      </CardContent></Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Information we use</h2>
        <p className="text-sm leading-7 text-muted-foreground">The information depends on the features you use and whether your account is a learner, parent, teacher, or school staff account.</p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
          <li><strong className="text-foreground">Account and profile details:</strong> name, username, email address, password authentication data, age, grade, avatar, optional profile details, and account role.</li>
          <li><strong className="text-foreground">Parent and guardian details:</strong> a guardian email address, verified guardian account identifier, approval timestamp, and the feature controls selected for a learner under 18.</li>
          <li><strong className="text-foreground">Education and school records:</strong> school membership, class and subject information, assignments, assessments, attendance or results where a school uses those features, and parent/teacher links.</li>
          <li><strong className="text-foreground">Learning activity:</strong> quiz and practice answers, scores, study sessions, goals, study plans, flashcards, reading progress, textbook/library activity, achievements, XP, streaks, and learning analytics.</li>
          <li><strong className="text-foreground">Social and safety information:</strong> friend and follow connections, posts, comments, reactions, messages, group memberships, multiplayer and call invitations, reports, blocks, and moderation records.</li>
          <li><strong className="text-foreground">Files and media:</strong> images or documents you choose to upload for supported profile, social, or learning features.</li>
          <li><strong className="text-foreground">Device and service information:</strong> push-notification registration tokens, notification preferences, app and device version information, connection details, and technical logs needed to operate and secure the service.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. How we use information</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
          <li>Create and secure accounts, authenticate users, and apply role-based access.</li>
          <li>Provide lessons, quizzes, study tools, school portals, progress tracking, and requested support.</li>
          <li>Personalize learning features and produce AI-assisted explanations, study plans, and learning insights.</li>
          <li>Operate friend connections, messages, groups, multiplayer, Study Mode calls, and notifications when those features are enabled.</li>
          <li>Receive and review reports, apply blocks, investigate misuse, and protect learners and the service.</li>
          <li>Maintain service reliability, prevent fraud or abuse, troubleshoot errors, and meet legal or school-record obligations.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Service providers and sharing</h2>
        <p className="text-sm leading-7 text-muted-foreground">We do not sell personal information. We share information with service providers only as needed to operate the features you use, protect the service, or meet legal obligations.</p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
          <li><strong className="text-foreground">Supabase:</strong> account authentication, database records, file storage, and server-side functions.</li>
          <li><strong className="text-foreground">Groq:</strong> AI features. When you use an AI feature, the prompt and relevant learning context—such as grade, subject, selected textbook excerpts, study goals, quiz performance, or learning progress—may be sent to Groq to generate a response. The information sent depends on the feature. Groq processes requests under its own service terms and privacy documentation.</li>
          <li><strong className="text-foreground">LiveKit:</strong> real-time Study Mode audio/video connections and related room, participant, and connection metadata. The current app call feature is designed for live communication and does not provide an in-app call-recording control.</li>
          <li><strong className="text-foreground">Firebase Cloud Messaging:</strong> push-notification delivery and device registration tokens. Notifications may contain event details such as an invitation or alert. Direct-message text is not included in the message push preview.</li>
          <li><strong className="text-foreground">Vercel:</strong> hosting the web app and public pages, including the external account-deletion page.</li>
          <li><strong className="text-foreground">Schools and linked family accounts:</strong> information may be visible to authorized school staff or linked parents/guardians when needed for the school or family features they use.</li>
        </ul>
        <p className="text-sm leading-7 text-muted-foreground">These providers may process information in countries other than the country where you live. Their own privacy and security terms also apply to the services they provide.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. AI-assisted features</h2>
        <p className="text-sm leading-7 text-muted-foreground">If you use AI Tutor, study planning, textbook analysis, learning insights, or related AI tools, Master Minds sends the information needed for that request to Groq. This can include the text you submit and relevant learning details or selected book excerpts. AI responses can be incomplete or incorrect; check important academic information against your textbooks or teacher. Do not enter passwords, private contact details, or other sensitive personal information into AI prompts.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Camera, microphone, contacts, and location</h2>
        <p className="text-sm leading-7 text-muted-foreground">Camera and microphone access are used for Study Mode voice/video calls when you choose to use those features. You can deny the permissions, but calls may not work. The current Android app does not request broad Contacts or Location permissions. You can manage camera, microphone, and notification permissions in your device settings.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Children, teens, and guardian controls</h2>
        <p className="text-sm leading-7 text-muted-foreground">Master Minds is designed for learners from kindergarten through Grade 12, including children and teens. For learner accounts under 18, social and communication features remain unavailable until a parent or legal guardian verifies the email address used for the request and confirms that they are an adult guardian. Approval does not automatically turn features on: friend connections, direct messages, group chat, public posts, multiplayer/tournaments, and Study Mode calls each have separate controls that start off.</p>
        <p className="text-sm leading-7 text-muted-foreground">A verified guardian can change these settings or revoke approval from Guardian Controls. Revoking approval turns off the controlled features. The email-and-attestation flow is an account safety measure; applicable parental-consent requirements can differ by country and may require additional steps.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. User content and safety</h2>
        <p className="text-sm leading-7 text-muted-foreground">Posts, comments, messages, uploads, and reports may be processed to deliver the relevant feature and enforce our Community Guidelines. Users can report content and block accounts. Authorized moderators may review reported content and take action under the Community Guidelines and Terms.</p>
        <p className="text-sm leading-7 text-muted-foreground"><Link to="/community-guidelines" className="font-medium text-primary underline underline-offset-4">Read the Community Guidelines</Link>.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">8. Retention and account deletion</h2>
        <p className="text-sm leading-7 text-muted-foreground">We keep information while an account is active and for as long as needed to provide the service, maintain security, resolve disputes, and meet school, financial, or legal obligations. Some school, invoice, payment, moderation, security, and audit records may need to be retained or de-identified even after an account is removed.</p>
        <p className="text-sm leading-7 text-muted-foreground">You can request deletion in the app under Settings or from any browser at <Link to="/delete-account" className="font-medium text-primary underline underline-offset-4">the external account-deletion page</Link>. Requests are verified and reviewed. School memberships, shared learning content, and financial or audit records may require a safe handover or lawful retention before deletion can be completed. We do not delete school invoices or financial audit records as part of a learner account deletion.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">9. Security</h2>
        <p className="text-sm leading-7 text-muted-foreground">We use access controls, authentication, database policies, and other reasonable safeguards to protect information. No internet service or storage system can be guaranteed completely secure. Keep your password private and tell us if you believe your account has been accessed without permission.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">10. Your choices and requests</h2>
        <p className="text-sm leading-7 text-muted-foreground">You can update supported profile and privacy settings, manage device permissions and notifications, use available block/report controls, and request access, correction, or deletion by contacting us. A parent or legal guardian may contact us about a learner account they are responsible for. We may need to verify the request before acting.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">11. Changes to this policy</h2>
        <p className="text-sm leading-7 text-muted-foreground">We may update this policy when the app or its data practices change. We will update the effective date and make the current version available on this page. If a change materially affects how information is used, we will provide an appropriate notice in the app where required.</p>
      </section>

      <Card><CardContent className="space-y-2 p-5">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="text-sm leading-7 text-muted-foreground">Masterminds Support Team</p>
        <a className="text-sm font-medium text-primary underline underline-offset-4" href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>
      </CardContent></Card>

      <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-sm text-muted-foreground">
        <Link to="/terms" className="underline underline-offset-4">Terms</Link>
        <Link to="/community-guidelines" className="underline underline-offset-4">Community Guidelines</Link>
        <Link to="/delete-account" className="underline underline-offset-4">Delete account</Link>
      </footer>
    </article>
  </main>
);

export default PrivacyPolicyPage;
