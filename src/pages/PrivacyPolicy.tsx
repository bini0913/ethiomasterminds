import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const PrivacyPolicy: React.FC = () => (
  <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Master Minds
      </Link>
      <header className="mt-8 border-b border-border pb-6">
        <div className="mb-3 flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold">Master Minds · Privacy</span></div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective date: 24 November 2026 · Last updated: 24 November 2026</p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          This policy explains how Master Minds handles information when students, families, teachers and school staff use the Master Minds app and related services.
        </p>
      </header>

      <article className="prose prose-slate mt-8 max-w-none dark:prose-invert prose-headings:scroll-mt-8 prose-p:leading-7">
        <h2>1. Who operates Master Minds</h2>
        <p>Master Minds is operated by the Masterminds Support Team. For privacy questions, data requests or account deletion, contact <a href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>. In this policy, “Master Minds”, “we” and “us” refer to the service and its operating support team.</p>

        <h2>2. Information we collect</h2>
        <p>The information we handle depends on the features you use and the role assigned to your account. It may include:</p>
        <ul>
          <li><strong>Account and profile information:</strong> email address used for sign-in, name, username, age or age range when supplied, grade, gender if supplied, avatar and account preferences.</li>
          <li><strong>Learning information:</strong> selected subjects, quizzes and answers, practice history, scores, study plans, flashcards, textbook or learning-resource selections, learning progress, achievements and study activity.</li>
          <li><strong>School information:</strong> school membership and role, class and division information, attendance, assessments, assignments, parent/student links and school communications. Finance-related information may be processed by authorised school finance workflows.</li>
          <li><strong>Social and communication information:</strong> friend requests and connections, posts, comments, reactions, uploaded images, direct messages, reports, multiplayer activity and Study Mode call invitations.</li>
          <li><strong>Device and service information:</strong> push-notification registration tokens, app and operating-system details made available to the service, security and rate-limit events, and technical logs needed to operate and protect the service.</li>
          <li><strong>Camera and microphone:</strong> when you choose to join a Study Mode audio or video call, the app requests the relevant device permission and sends the live audio/video stream through the calling service. Do not enable these permissions unless you intend to join a call.</li>
          <li><strong>AI learning requests:</strong> prompts, questions, answers, selected textbook excerpts and relevant learning context you submit to AI features.</li>
        </ul>
        <p>The Android app does not request access to your device contacts or precise/coarse location. Notifications require notification permission on supported Android versions. Camera and microphone access is requested only when you choose to use a Study Mode call.</p>
        <p>Please do not put passwords, government identity numbers, payment-card details, private contact information or other highly sensitive information into posts, chats or AI prompts.</p>

        <h2>3. How we use information</h2>
        <ul>
          <li>Create and secure accounts, authenticate users and maintain profiles.</li>
          <li>Provide learning, assessment, progress, school-management and communication features.</li>
          <li>Personalise learning explanations and study suggestions when an AI feature is used.</li>
          <li>Deliver notifications and invitations you or your school have enabled.</li>
          <li>Review reports, investigate abuse, enforce our terms and protect students and the service.</li>
          <li>Diagnose errors, prevent fraud or misuse, maintain backups and meet legal obligations.</li>
        </ul>

        <h2>4. Service providers and information sharing</h2>
        <p>We use service providers to operate Master Minds. Information is shared with them only as needed to provide the relevant feature, protect the service or meet a legal obligation:</p>
        <ul>
          <li><strong>Supabase:</strong> account authentication, database, file storage and server-side functions for profiles, learning records, school records and app features.</li>
          <li><strong>Groq:</strong> AI prompts and the learning context needed to generate requested tutor, explanation, study-planning or textbook-analysis responses. Groq may process request metadata and handles customer inputs under its own service terms and data controls.</li>
          <li><strong>LiveKit:</strong> real-time audio/video communication for Study Mode calls, including connection and call-room information.</li>
          <li><strong>Firebase Cloud Messaging / Google:</strong> push-notification delivery, which requires a device registration token and notification payload.</li>
          <li><strong>Google Sign-In:</strong> if you choose Google sign-in, Google processes the identity and authentication information needed to complete sign-in.</li>
          <li><strong>Vercel:</strong> hosting and delivery of the web application, including routine service and security logs.</li>
        </ul>
        <p>These providers may process information in countries other than the country where you live. Their processing is also governed by their own terms and privacy information. We do not sell personal information for money, and we do not use personal information for third-party targeted advertising through the app.</p>

        <h2>5. Children, families and school accounts</h2>
        <p>Master Minds is designed for learners across school age groups, including children and teenagers. For learner accounts under 18, we request a separate parent or legal guardian email address. We send an approval link to that address. The person receiving it must sign in with a verified email, confirm that they are at least 18 and are the learner's parent or legal guardian, and approve the request. The learner's community features remain disabled until that approval is recorded.</p>
        <p>After approval, community features still start off. The parent or guardian can separately enable or disable social posts, friend requests, direct and group messages, multiplayer invitations, Study Mode calls and public profile visibility. Public lobby chat remains disabled for under-18 learners, and their multiplayer rooms are limited to accepted friends or authorised school staff connections. They can also revoke consent; revocation turns the enabled features off. The approval process uses verified email and an adult/guardian attestation. It is not an identity-document or payment-card age check, and we do not claim that this process alone satisfies every parental-consent requirement in every country. Families should contact us if they need help or want to withdraw consent.</p>
        <p>Parents and authorised school staff may receive access to information needed for the school or parent features they use. Access should be limited by the role and permissions assigned to the account. Parents or guardians can contact us to ask about a learner's information, request correction or deletion, or raise a child-safety concern.</p>

        <h2>6. User content and safety</h2>
        <p>Posts, comments, messages, images, reports and other content you submit may be visible to the people or groups allowed by the feature and your privacy settings. Reports submitted in the app may be reviewed by authorised support or moderation personnel. You can report supported content and block accounts from within the app. Read our <Link to="/child-safety">Child Safety Standards</Link> for the reporting and response process. Do not share another person's personal information, private images, threats, bullying or unlawful material. We may restrict access to content or accounts when needed to respond to reports, protect users or enforce the Terms of Use.</p>

        <h2>7. Retention and deletion</h2>
        <p>We keep information for as long as it is needed to provide the service, maintain security, support school operations or meet applicable legal obligations. When an account deletion request is approved, we aim to remove or de-identify personal information associated with the account. Some records may need to be retained for a limited period where required for school recordkeeping, financial accountability, security, fraud prevention, dispute resolution or law. Where retention is necessary, we restrict access and do not use the retained record to keep the account active.</p>
        <p>To request deletion, use <Link to="/delete-account">the Master Minds account deletion page</Link> or email <a href="mailto:mindm1517@gmail.com?subject=Master%20Minds%20account%20deletion%20request">mindm1517@gmail.com</a>. An in-app request signs you out and restricts account access while the support team verifies and processes it. Never email us your password or verification code. We may ask for reasonable proof that you control the account before acting on a request. We may keep a minimal deletion-request record to document the request and its handling.</p>

        <h2>8. Your choices and requests</h2>
        <p>You can manage some profile visibility, online-status and notification preferences in app settings. You may contact us to request access to, correction of, or deletion of personal information, or to ask a question about how information is handled. If you are a child, a parent or guardian may contact us on your behalf.</p>

        <h2>9. Security</h2>
        <p>We use account authentication, access controls, database policies and service-provider security measures designed to protect information. No online service can guarantee absolute security. Keep your password private, sign out on shared devices and report suspected account access or safety issues promptly.</p>

        <h2>10. Changes to this policy</h2>
        <p>We may update this policy when the app or its data practices change. We will post the current version on this page and update the effective date. If a change materially affects how information is handled, we will provide an appropriate notice through the service or another available contact method.</p>

        <h2>11. Contact</h2>
        <p>For privacy questions, guardian requests, child-safety concerns or data requests, contact the Masterminds Support Team at <a href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>.</p>
      </article>
      <footer className="mt-10 border-t border-border pt-5 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" to="/terms">Terms of Use</Link>
        <span className="mx-2">·</span>
        <Link className="hover:text-foreground" to="/delete-account">Account deletion</Link>
        <span className="mx-2">·</span>
        <Link className="hover:text-foreground" to="/child-safety">Child Safety Standards</Link>
      </footer>
    </div>
  </main>
);

export default PrivacyPolicy;
