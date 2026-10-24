import React from "react";

type UpperAppShellProps = {
  children: React.ReactNode;
};

/**
 * Content boundary for the Grades 9–12 Academic Studio.
 * AppChrome owns responsive navigation; this component keeps upper-tier
 * pages inside the shared semantic theme and exposes the academic calendar.
 */
const UpperAppShell: React.FC<UpperAppShellProps> = ({ children }) => (
  <div className="tier-upper min-w-0 bg-background text-foreground">
    <div className="flex min-h-7 items-center justify-end border-b border-border/60 px-4 py-1.5 text-[10px] font-medium text-muted-foreground sm:px-6 lg:px-8">
      Academic Year 2017 E.C. (2024/25 G.C.)
    </div>
    {children}
  </div>
);

export default UpperAppShell;
