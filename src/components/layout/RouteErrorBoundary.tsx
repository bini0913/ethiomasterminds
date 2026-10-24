import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/** Isolates render-time failures so one secondary page cannot blank the app shell. */
export default class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Route rendering failed:", error, info.componentStack);
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center p-5">
        <section role="alert" className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
          <h1 className="text-xl font-bold tracking-tight">This page couldn’t load</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">A page-level error occurred. Your account and saved learning data have not been changed by this screen. Try rendering the page again or return to the dashboard.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={this.retry}><RotateCcw className="mr-2 h-4 w-4" />Try again</Button>
            <Button variant="outline" onClick={() => { window.location.assign("/"); }}>Go to home</Button>
          </div>
        </section>
      </main>
    );
  }
}
