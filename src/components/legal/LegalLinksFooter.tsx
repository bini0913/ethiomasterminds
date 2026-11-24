import React from "react";
import { Link } from "react-router-dom";

const LegalLinksFooter: React.FC = () => (
  <nav aria-label="Legal links" className="mx-auto flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 py-4 text-xs font-medium text-muted-foreground">
    <Link to="/privacy-policy" className="underline-offset-4 hover:text-primary hover:underline">Privacy Policy</Link>
    <Link to="/terms" className="underline-offset-4 hover:text-primary hover:underline">Terms</Link>
    <Link to="/community-guidelines" className="underline-offset-4 hover:text-primary hover:underline">Community Guidelines</Link>
    <Link to="/delete-account" className="underline-offset-4 hover:text-primary hover:underline">Delete account</Link>
  </nav>
);

export default LegalLinksFooter;
