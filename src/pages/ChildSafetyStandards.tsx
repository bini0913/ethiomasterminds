import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Mail } from "lucide-react";

const ChildSafetyStandards: React.FC = () => (
  <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Master Minds
      </Link>
      <header className="mt-8 border-b border-border pb-6">
        <div className="mb-3 flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold">Master Minds · Child safety</span></div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Child Safety Standards</h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective date: 24 November 2026 · Last updated: 24 November 2026</p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">Master Minds is an educational service used by children, teenagers, families and school communities. Protecting learners is a core requirement for using the service.</p>
      </header>

      <article className="prose prose-slate mt-8 max-w-none dark:prose-invert prose-headings:scroll-mt-8 prose-p:leading-7">
        <h2>1. Zero tolerance for child exploitation</h2>
        <p>Master Minds prohibits child sexual abuse and exploitation, grooming, sexualisation of minors, sextortion, trafficking, and any content or conduct that seeks to exploit or endanger a child. Users must not create, request, upload, share, promote or forward such material. Attempts to move a child into unsafe private contact or arrange harmful offline contact are also prohibited.</p>

        <h2>2. Safer community features</h2>
        <ul>
          <li>Accounts for learners under 18 require a separate parent or legal guardian email and a verified approval step before community features can be used.</li>
          <li>For under-18 learners, social posts, friend requests, direct and group messages, multiplayer invitations, Study Mode calls and public profile visibility start disabled. A parent or legal guardian chooses which features to enable and may revoke approval.</li>
          <li>For under-18 learner accounts, public lobby chat is disabled. Multiplayer room entry and invitations are limited to accepted friends or authorised school staff connections, and Study Mode calls require an accepted friend connection.</li>
          <li>Users can report posts, comments, accounts and supported message types from inside the app. Users can also block another account. Blocking prevents new direct contact and hides the blocked account's content in supported social and communication views.</li>
          <li>Users must follow the <Link to="/terms">Terms of Use and Community Guidelines</Link>. Reports are reviewed by authorised moderators, who can remove content, restrict features, suspend accounts or ban accounts where appropriate.</li>
        </ul>

        <h2>3. How to report a child-safety concern</h2>
        <p>Use the report control next to the relevant content or account whenever it is available. Select the closest reason and include a short explanation. Do not download, copy, forward or email suspected illegal images or videos. Do not include passwords or verification codes in a report.</p>
        <p>For an urgent child-safety concern, contact a parent, teacher or trusted adult. If someone is in immediate danger, contact the appropriate local emergency service. The Master Minds report system and support email are not emergency services.</p>

        <h2>4. Review and response</h2>
        <p>Authorised moderators review reports, consider the available context and record enforcement actions. For serious child-safety concerns, access to reported content or accounts may be restricted while the concern is reviewed. Where we obtain actual knowledge of child sexual abuse or exploitation material, we will act to remove access, preserve only the information needed for a lawful investigation, and report to the appropriate competent authority where required by applicable law. Access to reports and retained evidence is limited to people who need it for safety, legal or moderation work.</p>

        <h2>5. Child Safety Point of Contact</h2>
        <div className="not-prose rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Masterminds Support Team</p>
              <p className="mt-1 text-sm text-muted-foreground">Child Safety and UGC Moderation Contact</p>
              <a className="mt-2 inline-block text-sm font-medium text-primary underline" href="mailto:mindm1517@gmail.com?subject=Master%20Minds%20child%20safety%20concern">mindm1517@gmail.com</a>
            </div>
          </div>
        </div>
        <p>Use this address for child-safety concerns, moderation escalation and questions about these standards. Do not attach suspected illegal material. Provide the account username, report ID if available, and a concise description instead.</p>

        <h2>6. Changes to these standards</h2>
        <p>We may update these standards as our safety processes, features or legal obligations change. The current version will be published on this page.</p>
      </article>

      <footer className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" to="/privacy">Privacy Policy</Link>
        <Link className="hover:text-foreground" to="/terms">Terms of Use</Link>
        <Link className="hover:text-foreground" to="/delete-account">Account deletion</Link>
      </footer>
    </div>
  </main>
);

export default ChildSafetyStandards;
