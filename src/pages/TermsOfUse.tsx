import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { COMMUNITY_TERMS_VERSION } from "@/context/CommunityTermsContext";
import { ArrowLeft, BookOpenCheck } from "lucide-react";

const TermsOfUse: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accepting, setAccepting] = React.useState(false);
  const requestedReturnTo = searchParams.get("returnTo") || "/";
  const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/";

  const acceptTerms = async () => {
    if (!user?.id || accepting) return;
    setAccepting(true);
    const { error } = await (supabase as any).from("user_policy_acceptances").insert({
      user_id: user.id,
      policy_key: "community_terms",
      policy_version: COMMUNITY_TERMS_VERSION,
      source: "terms_page",
    });
    setAccepting(false);
    if (error && error.code !== "23505") {
      toast.error("Your acceptance could not be saved. Please try again.");
      return;
    }
    toast.success("Community rules accepted.");
    navigate(returnTo, { replace: true });
  };

  return (
  <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Master Minds
      </Link>
      <header className="mt-8 border-b border-border pb-6">
        <div className="mb-3 flex items-center gap-2 text-primary"><BookOpenCheck className="h-5 w-5" /><span className="text-sm font-semibold">Master Minds · Community standards</span></div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Use</h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective date: 24 November 2026 · Last updated: 24 November 2026</p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">These terms explain the rules for using Master Minds learning, school, communication and community features.</p>
      </header>

      {user && (
        <section className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="font-semibold">Community participation</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">You must accept the current Terms of Use and Community Guidelines before posting, commenting, messaging or creating community content.</p>
          <Button className="mt-4" onClick={() => void acceptTerms()} disabled={accepting}>
            {accepting ? "Saving acceptance…" : "I agree to the Terms of Use and Community Guidelines"}
          </Button>
        </section>
      )}

      <article className="prose prose-slate mt-8 max-w-none dark:prose-invert prose-headings:scroll-mt-8 prose-p:leading-7">
        <h2>1. Using Master Minds</h2>
        <p>Master Minds provides educational tools, study activities, school-management features and optional communication features. You agree to use the service lawfully, honestly and respectfully. If you use Master Minds for a school, you must also follow the rules and instructions of that school.</p>

        <h2>2. Accounts and eligibility</h2>
        <p>Provide accurate information when creating an account and keep your sign-in details private. Do not impersonate another person, misstate your age, share your password or use another person's account. Learners under 18 must provide a separate parent or legal guardian email and complete the approval process. Community features remain disabled until a parent or legal guardian verifies their email and approves. Parents can then choose which community features are enabled and can revoke that approval at any time. Parents and schools must use their own authorised accounts and must not ask learners to share passwords.</p>

        <h2>3. Learning and AI features</h2>
        <p>Learning materials, AI explanations, generated questions and study suggestions are provided to support learning. They can contain mistakes and are not a substitute for your teacher, official curriculum, verified examination materials or professional advice. Check important answers against your textbook, teacher or official source. Do not submit confidential school records or another person's sensitive information to an AI feature.</p>

        <h2>4. Community and user-generated content rules</h2>
        <p>When you create a post, comment, message, image, profile or other user content, you remain responsible for what you submit. You must not:</p>
        <ul>
          <li>Harass, bully, threaten, humiliate, stalk or intimidate another person.</li>
          <li>Share sexual content, exploitative content, child sexual abuse material, or content that sexualises or endangers a child.</li>
          <li>Share another person's private information, contact details, school records, passwords or images without permission.</li>
          <li>Post hate speech, discriminatory abuse, violent threats, self-harm encouragement or instructions for dangerous wrongdoing.</li>
          <li>Impersonate a person, spread scams or spam, manipulate competitions, or interfere with another user's account.</li>
          <li>Upload content that you do not have the right to share or that violates another person's intellectual-property rights.</li>
        </ul>
        <p>Keep conversations respectful and limited to people you know through appropriate school or friend connections. Do not arrange to meet an online contact in person without a parent or trusted adult. If something makes you uncomfortable, stop interacting and tell a parent, teacher or trusted adult.</p>

        <h2>5. Parent-managed community features</h2>
        <p>For learner accounts under 18, community access is controlled by the verified parent or legal guardian. Social posts, friend requests, direct and group messages, multiplayer invitations, Study Mode calls and public profile visibility can be enabled separately. Public lobby chat remains disabled, multiplayer rooms are limited to accepted friends or authorised school staff connections, and Study Mode calls require an accepted friend connection. A parent may turn enabled features off or revoke approval. We may restrict access to these features when required by account status, safety settings or these terms.</p>

        <h2>6. Reporting and safety</h2>
        <p>Use the in-app report controls to flag content or conduct that may break these terms. Include enough detail for the support team to understand the concern. Do not submit false or knowingly misleading reports. We may review reports and take proportionate action, which can include removing content, restricting a feature or suspending an account. For urgent child-safety concerns, contact a parent or trusted adult and email <a href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>.</p>

        <h2>7. Your content</h2>
        <p>You keep the rights you already have in content you create. You give Master Minds permission to host, store, display and transmit that content only as needed to operate the features you choose, apply your privacy settings, respond to reports and protect the service. You can request deletion of your account and associated content through the account deletion process, subject to limited retention required for legitimate school, financial, security or legal purposes.</p>

        <h2>8. School and parent access</h2>
        <p>School and parent features may make learner information available to authorised people for education, supervision and school administration. Do not attempt to access information or portals outside the role and permissions assigned to you. Schools and authorised staff are responsible for using learner information only for legitimate school purposes.</p>

        <h2>9. Enforcement</h2>
        <p>We may investigate credible reports, preserve relevant information where legally permitted, remove content, limit communication or other features, or suspend or terminate access when reasonably necessary to protect users, enforce these terms or comply with law. We may also act to prevent repeated or serious violations. We aim to handle reports fairly and limit access to report information to authorised reviewers.</p>

        <h2>10. Availability and changes</h2>
        <p>We work to keep Master Minds available and secure, but some features may be interrupted for maintenance, updates or circumstances outside our control. We may change features or these terms as the service develops. The latest version will be posted on this page.</p>

        <h2>11. Account deletion and contact</h2>
        <p>You may request account deletion in app settings or through the public <Link to="/delete-account">account deletion page</Link>. Some school, financial, security or legal records may need to be retained where permitted or required by law. For help, contact the Masterminds Support Team at <a href="mailto:mindm1517@gmail.com">mindm1517@gmail.com</a>.</p>
      </article>
      <footer className="mt-10 border-t border-border pt-5 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" to="/privacy">Privacy Policy</Link>
        <span className="mx-2">·</span>
        <Link className="hover:text-foreground" to="/delete-account">Account deletion</Link>
        <span className="mx-2">·</span>
        <Link className="hover:text-foreground" to="/child-safety">Child Safety Standards</Link>
      </footer>
    </div>
  </main>
  );
};

export default TermsOfUse;
