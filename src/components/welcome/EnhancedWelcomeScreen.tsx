import React from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/common/LanguageSelector";

interface EnhancedWelcomeScreenProps {
  onContinue: (userType?: "student" | "teacher" | "admin" | "manager", mode?: "signin" | "signup") => void;
}

const EnhancedWelcomeScreen: React.FC<EnhancedWelcomeScreenProps> = ({ onContinue }) => (
  <main className="flex min-h-[100svh] items-center justify-center bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
      <LanguageSelector />
    </div>

    <section className="w-full max-w-sm text-center">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.6rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <img
          src="/brand/master-minds-icon.svg"
          alt="Master Minds logo"
          className="h-full w-full object-contain p-2"
        />
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight">Master Minds</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Learn, practice, and grow — all in one place.
      </p>

      <div className="mt-8 space-y-3">
        <Button
          size="lg"
          onClick={() => onContinue("student", "signin")}
          className="h-12 w-full rounded-xl text-base font-semibold"
        >
          Sign in
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => onContinue("student", "signup")}
          className="h-12 w-full rounded-xl border-slate-300 bg-white text-base font-semibold dark:border-slate-700 dark:bg-slate-900"
        >
          Create an account
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span>OR</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <Button
        variant="ghost"
        onClick={() => onContinue("teacher", "signin")}
        className="h-10 w-full rounded-xl text-sm text-slate-600 hover:text-blue-700 dark:text-slate-300"
      >
        <GraduationCap className="mr-2 h-4 w-4" />
        Teacher & staff sign in
      </Button>

      <p className="mt-10 text-xs text-slate-400">Master Minds · Learn. Practice. Grow.</p>
    </section>
  </main>
);

export default EnhancedWelcomeScreen;
