import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import React, { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import MasterMindsLogo from "@/components/brand/MasterMindsLogo";

type Props = { children: ReactNode };
type State = { hasError: boolean };

class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Master Minds runtime error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A1526] px-6 text-white">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl backdrop-blur-xl">
          <MasterMindsLogo
            variant="light"
            layout="symbol"
            symbolClassName="mx-auto mb-6 h-20 w-20"
          />
          <h1 className="text-2xl font-bold">Master Minds needs to reload</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Something unexpected happened while loading this screen. Your account and progress are safe.
          </p>
          <Button
            onClick={this.handleReload}
            className="mt-6 w-full bg-[#0055FF] text-white hover:bg-[#0055FF]/90"
          >
            Reload Master Minds
          </Button>
        </section>
      </main>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
