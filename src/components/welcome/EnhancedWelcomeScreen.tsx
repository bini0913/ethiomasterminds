import React from "react";
import { ArrowRight, BookOpen, GraduationCap, Trophy, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/common/LanguageSelector";

interface EnhancedWelcomeScreenProps {
  onContinue: (userType?: "student" | "teacher" | "admin" | "manager", mode?: "signin" | "signup") => void;
}

const features = [
  { icon: BookOpen, label: "Adaptive grade paths", detail: "KG–Grade 12" },
  { icon: Trophy, label: "Realtime battles & XP", detail: "Learn together" },
  { icon: Target, label: "National exam practice", detail: "Prepare with purpose" },
];

const EnhancedWelcomeScreen: React.FC<EnhancedWelcomeScreenProps> = ({ onContinue }) => (
  <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#0A1120] px-4 py-10 text-white">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 top-[-8rem] h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute -right-28 bottom-[-10rem] h-[28rem] w-[28rem] rounded-full bg-blue-600/25 blur-3xl" />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(#9acbff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
    </div>

    <div className="absolute right-4 top-4 z-10 sm:right-7 sm:top-7">
      <LanguageSelector />
    </div>

    <section className="relative z-10 mx-auto w-full max-w-3xl pb-4 pt-12 text-center">
      <div className="mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-[1.8rem] border border-cyan-200/20 bg-white/10 p-2 shadow-[0_0_55px_rgba(0,229,255,0.22)] backdrop-blur">
        <img src="/brand/master-minds-icon.svg" alt="Master Minds emblem" className="h-full w-full object-contain" />
      </div>

      <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
        Your learning adventure starts here
      </p>
      <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Master Minds</h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
        The smartest way to learn, practice, and conquer your exams.
      </p>

      <div className="mx-auto mt-9 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        {features.map(({ icon: Icon, label, detail }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-cyan-200"><Icon className="h-5 w-5" /></span>
            <span><span className="block text-sm font-bold text-white">{label}</span><span className="mt-0.5 block text-xs text-slate-400">{detail}</span></span>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 grid w-full max-w-md gap-3">
        <Button onClick={() => onContinue("student", "signup")} className="btn-3d-primary h-14 rounded-2xl text-base font-black tracking-wide text-white">
          GET STARTED <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button onClick={() => onContinue("student", "signin")} variant="outline" className="h-14 rounded-2xl border-white/25 bg-white/[0.06] text-sm font-bold text-white shadow-[0_4px_0_rgba(255,255,255,0.12)] hover:bg-white/10 hover:text-white">
          I ALREADY HAVE AN ACCOUNT
        </Button>
        <button type="button" onClick={() => onContinue("teacher", "signin")} className="mx-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-300 transition hover:text-cyan-200">
          <Users className="h-4 w-4" /> Teacher, Parent & Staff Access
        </button>
      </div>
      <p className="mt-8 text-xs font-medium tracking-wide text-slate-500">LEARN. COMPETE. LEVEL UP.</p>
      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-600"><GraduationCap className="h-3.5 w-3.5" /> Built for learners across Ethiopia</div>
    </section>
  </main>
);

export default EnhancedWelcomeScreen;
