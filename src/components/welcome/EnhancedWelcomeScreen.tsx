import React from "react";
import LanguageSelector from "@/components/common/LanguageSelector";

interface EnhancedWelcomeScreenProps {
  onContinue: (userType?: "student" | "teacher" | "admin" | "manager", mode?: "signin" | "signup") => void;
}

const EnhancedWelcomeScreen: React.FC<EnhancedWelcomeScreenProps> = ({ onContinue }) => (
  <main className="flex min-h-[100svh] flex-col bg-background text-foreground">
    <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-4">
      <span className="text-base font-black tracking-tight text-primary">master minds</span>
      <LanguageSelector />
    </header>

    <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
      <img
        src="/brand/master-minds-icon.svg"
        alt="Master Minds"
        className="mb-8 h-32 w-32 rounded-[2rem] sm:h-40 sm:w-40"
      />
      <h1 className="text-[28px] font-black leading-tight tracking-tight sm:text-3xl">
        Learn something new.
        <br />
        Every single day.
      </h1>
      <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
        Lessons, quizzes and exam practice built for Ethiopian students — from KG to Grade 12.
      </p>
    </section>

    <footer className="mx-auto w-full max-w-md space-y-3 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
      <button type="button" onClick={() => onContinue("student", "signup")} className="mm-btn">
        Get started
      </button>
      <button type="button" onClick={() => onContinue("student", "signin")} className="mm-btn-outline">
        I already have an account
      </button>
      <button
        type="button"
        onClick={() => onContinue("teacher", "signin")}
        className="block w-full py-2 text-center text-sm font-bold text-muted-foreground hover:text-primary"
      >
        Teacher, parent or staff? Sign in here
      </button>
      <LegalLinksFooter />
    </footer>
  </main>
);

export default EnhancedWelcomeScreen;
