import React from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type BoundaryProps = {
  children: React.ReactNode;
  routePath: string;
};

type BoundaryState = {
  hasError: boolean;
  errorMessage: string | null;
};

/**
 * Keeps render-time failures isolated to the current route.
 * A failed lazy page must not leave the whole authenticated app shell broken
 * after the user navigates to a different screen.
 */
class RouteErrorBoundaryInstance extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "Unknown rendering error",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Master Minds] Route render failed", {
      route: this.props.routePath,
      message: error.message,
      error,
      componentStack: info.componentStack,
    });
  }

  private retry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center p-5">
        <section
          role="alert"
          aria-live="assertive"
          className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Screen: {this.props.routePath}
          </p>
          <h1 className="mt-2 text-xl font-bold tracking-tight">This page couldn’t load</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This screen encountered an unexpected rendering error. Your account and saved learning data have not been changed by this screen. You can retry or open another section.
          </p>
          {import.meta.env.DEV && this.state.errorMessage && (
            <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.errorMessage}
            </pre>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={this.retry}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => { window.location.assign("/"); }}>
              Go to home
            </Button>
          </div>
        </section>
      </main>
    );
  }
}

/**
 * Key the boundary by pathname so a crash on one route is cleared as soon as
 * navigation moves to a different route. Query-string changes do not remount
 * the boundary because they are often part of a single page's own workflow.
 */
export default function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <RouteErrorBoundaryInstance key={location.pathname} routePath={location.pathname}>
      {children}
    </RouteErrorBoundaryInstance>
  );
}
