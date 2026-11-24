import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";

const AccountRestricted: React.FC = () => {
  const { user, logout } = useUser();
  const status = user?.accountStatus || "restricted";
  const title = status === "banned" ? "Account access disabled" : "Account temporarily restricted";
  const description = status === "banned"
    ? "This account has been disabled following a moderation or safety review."
    : "This account is currently restricted. If you requested account deletion, the support team is verifying and processing the request. If you believe this restriction is a mistake, contact support for a review.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <p className="mt-4 text-xs text-muted-foreground">Support: mindm1517@gmail.com</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <a href="mailto:mindm1517@gmail.com?subject=Master%20Minds%20account%20review">
              <Mail className="mr-2 h-4 w-4" /> Contact support
            </a>
          </Button>
          <Button onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
        {!user && <p className="mt-5 text-sm text-muted-foreground"><Link to="/" className="text-primary underline">Return to sign in</Link></p>}
      </section>
    </main>
  );
};

export default AccountRestricted;
