import React from "react";
import { BookOpen, Brain, Gamepad2, GraduationCap, MessageCircle, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/common/LanguageSelector";

interface EnhancedWelcomeScreenProps {
  onContinue: (userType?: "student" | "teacher" | "admin" | "manager", mode?: "signin" | "signup") => void;
}

const learningPaths = [
  { title: "Learn at your level", description: "Lessons and practice shaped around your grade.", icon: BookOpen },
  { title: "Practice and play", description: "Build skills with quizzes, games and challenges.", icon: Gamepad2 },
  { title: "Track your progress", description: "See your growth and keep your learning goals moving.", icon: Trophy },
];

const experiences = [
  { title: "KG–Grade 4", description: "Play, stories and joyful discovery", tone: "bg-sky-50 text-sky-700 border-sky-100" },
  { title: "Grades 5–8", description: "Study, practice and compete", tone: "bg-blue-50 text-blue-700 border-blue-100" },
  { title: "Grades 9–12", description: "Focused study and exam preparation", tone: "bg-indigo-50 text-indigo-700 border-indigo-100" },
];

const EnhancedWelcomeScreen: React.FC<EnhancedWelcomeScreenProps> = ({ onContinue }) => (
  <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
      <a href="/" className="flex min-w-0 items-center gap-3" aria-label="Master Minds home">
        <img src="/brand/master-minds-icon.svg" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <span className="min-w-0">
          <span className="block text-lg font-extrabold tracking-tight">Master Minds</span>
          <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">Learn. Practice. Grow.</span>
        </span>
      </a>
      <div className="flex items-center gap-2 sm:gap-3">
        <LanguageSelector />
        <Button variant="ghost" onClick={() => onContinue("student", "signin")} className="hidden rounded-xl sm:inline-flex">
          Sign in
        </Button>
        <Button onClick={() => onContinue("student", "signup")} className="rounded-xl px-4 sm:px-5">
          Get started
        </Button>
      </div>
    </header>

    <main>
      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-14 pt-8 sm:px-8 sm:pb-20 sm:pt-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:px-10 lg:pb-24 lg:pt-14">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-2 text-sm font-semibold text-blue-800 shadow-sm dark:border-blue-900 dark:bg-slate-900 dark:text-blue-200">
            <Sparkles className="h-4 w-4" />
            A smarter way to learn, for every grade
          </div>
          <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Make every study session <span className="text-blue-700 dark:text-blue-400">count.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg sm:leading-8">
            Learn your way with level-based lessons, quick quizzes, learning games, friends and tools that help you prepare with confidence.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" onClick={() => onContinue("student", "signup")} className="h-12 rounded-xl px-6 text-base font-bold shadow-sm">
              Create a free account
              <GraduationCap className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => onContinue("student", "signin")} className="h-12 rounded-xl border-slate-300 bg-white px-6 text-base dark:border-slate-700 dark:bg-slate-900">
              I already have an account
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-700 dark:text-blue-400" /> Your own learning profile</span>
            <span className="inline-flex items-center gap-2"><Brain className="h-4 w-4 text-blue-700 dark:text-blue-400" /> Personalized by grade</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-blue-200/40 blur-2xl dark:bg-blue-900/20" />
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">Your learning space</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">A little progress, every day</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-blue-700 p-4 text-white">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-blue-100">Study</span><Brain className="h-5 w-5 text-blue-100" /></div>
                <p className="mt-7 text-lg font-bold">Learn something new</p>
                <p className="mt-1 text-xs text-blue-100">Lessons and revision</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-600 dark:text-slate-300">Play</span><Gamepad2 className="h-5 w-5 text-blue-700 dark:text-blue-300" /></div>
                <p className="mt-7 text-lg font-bold">Practice your skills</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Quizzes and games</p>
              </div>
            </div>
            <div className="mt-3 space-y-2.5">
              {learningPaths.map(({ title, description, icon: Icon }, index) => (
                <div key={title} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3.5 dark:border-slate-800">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p></div>
                  <span className="text-xs font-semibold text-slate-400">0{index + 1}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
              <MessageCircle className="h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Learn with friends and celebrate your progress together.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-10 lg:py-14">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">Made for your stage</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">The right experience for every learner</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Your grade helps shape the tools, activities and study experience you see.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {experiences.map((experience) => (
              <div key={experience.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold dark:bg-slate-900 dark:border-slate-700 dark:text-blue-200 ${experience.tone}`}>{experience.title}</div>
                <p className="mt-4 text-base font-semibold">{experience.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={() => onContinue("student", "signup")} className="h-12 rounded-xl px-7">Start learning</Button>
            <Button size="lg" variant="ghost" onClick={() => onContinue("teacher", "signin")} className="h-12 rounded-xl px-5">Teacher and staff sign in</Button>
          </div>
        </div>
      </section>
    </main>

    <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 text-center text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:px-8 lg:px-10">
      <span>© {new Date().getFullYear()} Master Minds</span>
      <span>Learn. Practice. Grow.</span>
    </footer>
  </div>
);

export default EnhancedWelcomeScreen;
