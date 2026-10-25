import { useNavigate } from "react-router-dom";
import {
  Activity, ArrowUpRight, BookOpen, BrainCircuit, CalendarDays, ChevronRight,
  CirclePlay, Compass, GraduationCap, LibraryBig, MessageCircle, Search,
  Settings2, Sparkles, Swords, Target, Trophy, Users, Video, Zap
} from "lucide-react";
import { useUser } from "@/context/UserContext";

const primaryLinks = [
  { label: "Study Mode", description: "Focus together, live", path: "/study-mode", icon: Video, tone: "violet" },
  { label: "Academic Prep", description: "Prepare for your next exam", path: "/academic", icon: GraduationCap, tone: "blue" },
  { label: "Multiplayer", description: "Challenge your friends", path: "/multiplayer", icon: Swords, tone: "orange" },
  { label: "Tournaments", description: "Compete and climb", path: "/tournaments", icon: Trophy, tone: "green" },
];

const learningLinks = [
  { label: "Exam Mode", path: "/academic/exam", icon: Target },
  { label: "Topic Coverage", path: "/academic/topics", icon: BookOpen },
  { label: "Study Planner", path: "/academic/planner", icon: CalendarDays },
  { label: "Academic Insights", path: "/academic/insights", icon: Activity },
  { label: "Flashcards", path: "/academic/flashcards", icon: BrainCircuit },
  { label: "Entrance Papers", path: "/academic/entrance-papers", icon: GraduationCap },
];

const navGroups = [
  { title: "Workspace", items: [
    { label: "Home", path: "/", icon: Compass },
    { label: "Study Mode", path: "/study-mode", icon: Video },
    { label: "Academic Prep", path: "/academic", icon: BookOpen },
    { label: "Multiplayer", path: "/multiplayer", icon: Swords },
    { label: "Tournaments", path: "/tournaments", icon: Trophy },
  ]},
  { title: "Your learning", items: [
    { label: "Learning DNA", path: "/learning-dna", icon: BrainCircuit },
    { label: "Library", path: "/library", icon: LibraryBig },
    { label: "Friends & chat", path: "/friends", icon: Users },
  ]},
];

const toneClasses: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export default function UpperTierHome() {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";
  const grade = user?.grade ? `Grade ${user.grade.replace(/^grade\s*/i, "")}` : "High school";
  const initials = user?.name?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "MM";

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-slate-200/80 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <button onClick={() => navigate("/")} className="mb-9 flex items-center gap-3 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><BrainCircuit size={22}/></span>
          <span><span className="block text-[15px] font-bold tracking-tight">Master Minds</span><span className="block text-xs text-slate-500">Student workspace</span></span>
        </button>
        {navGroups.map((group) => <div key={group.title} className="mb-7">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">{group.title}</p>
          <nav className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.label === "Home";
              return <button key={item.label} onClick={() => navigate(item.path)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
                <Icon size={18}/><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600"/>}
              </button>;
            })}
          </nav>
        </div>)}
        <div className="mt-auto rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
          <div className="mb-2 flex items-center gap-2 text-indigo-700 dark:text-indigo-300"><Sparkles size={16}/><span className="text-xs font-semibold">A little progress daily</span></div>
          <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">Small, consistent study sessions add up. Pick one goal and get started.</p>
          <button onClick={() => navigate("/academic/planner")} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Open planner <ArrowUpRight size={13}/></button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-7 xl:px-10">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white"><BrainCircuit size={19}/></span>
              <span className="truncate font-bold">Master Minds</span>
            </div>
            <div className="hidden min-w-0 items-center gap-2 text-sm text-slate-500 lg:flex"><span>Workspace</span><ChevronRight size={15}/><span className="font-semibold text-slate-900 dark:text-white">Home</span></div>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button onClick={() => navigate("/library")} aria-label="Search learning resources" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Search size={18}/></button>
              <button onClick={() => navigate("/notifications")} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Activity size={18}/></button>
              <button onClick={() => navigate("/settings")} aria-label="Settings" className="hidden h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:grid"><Settings2 size={18}/></button>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900" title={user?.name || "Student"}>{initials}</div>
              <button onClick={() => void logout()} className="hidden rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:block dark:hover:bg-slate-800">Log out</button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 pb-28 pt-7 sm:px-7 sm:pt-9 lg:px-10 lg:pb-12">
          <section className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-slate-900 dark:text-indigo-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>{grade} · Your learning space</div>
              <h1 className="text-3xl font-bold tracking-[-.04em] sm:text-4xl xl:text-[42px]">Good to see you, {firstName}.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">What would you like to make progress on today?</p>
            </div>
            <button onClick={() => navigate("/academic/planner")} className="inline-flex w-fit items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-700"><CalendarDays size={17}/> Plan a study session</button>
          </section>

          <section className="mb-9 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {primaryLinks.map((item) => {
              const Icon = item.icon;
              return <button key={item.label} onClick={() => navigate(item.path)} className="group rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm shadow-slate-900/[.02] transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-900/[.05] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800">
                <div className="mb-5 flex items-start justify-between"><span className={`grid h-11 w-11 place-items-center rounded-xl ${toneClasses[item.tone]}`}><Icon size={21}/></span><ArrowUpRight size={18} className="text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-indigo-600"/></div>
                <span className="block text-base font-bold tracking-tight">{item.label}</span><span className="mt-1 block text-sm text-slate-500">{item.description}</span>
              </button>;
            })}
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.85fr)]">
            <section className="min-w-0">
              <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-indigo-600 dark:text-indigo-300">Keep learning</p><h2 className="mt-1 text-xl font-bold tracking-tight">Your study toolkit</h2></div><button onClick={() => navigate("/academic")} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-slate-500 hover:text-indigo-600">All academic tools <ChevronRight size={16}/></button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {learningLinks.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => navigate(item.path)} className="flex min-h-[86px] items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon size={19}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs text-slate-500">Open {item.label.toLowerCase()}</span></span><ChevronRight size={16} className="shrink-0 text-slate-400"/></button>; })}
              </div>
            </section>
            <aside className="space-y-5">
              <section className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white">
                <div className="mb-5 flex items-center justify-between"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-indigo-200">Your personal learning profile</span><BrainCircuit size={20} className="text-indigo-300"/></div>
                <h2 className="text-xl font-bold tracking-tight">Understand how you learn.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">Explore your Learning DNA to see insights based on your learning activity.</p>
                <button onClick={() => navigate("/learning-dna")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-50">Explore Learning DNA <ArrowUpRight size={16}/></button>
              </section>
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Users size={19}/></span><div><h3 className="text-sm font-bold">Learn with people</h3><p className="mt-1 text-xs text-slate-500">Study, chat, and play together</p></div></div>
                <div className="grid grid-cols-2 gap-2"><button onClick={() => navigate("/friends")} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Find friends</button><button onClick={() => navigate("/chat")} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><span className="inline-flex items-center gap-2"><MessageCircle size={15}/> Open chat</span></button></div>
              </section>
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><Zap size={19}/></span><div className="min-w-0 flex-1"><h3 className="text-sm font-bold">Quick revision</h3><p className="mt-1 text-xs text-slate-500">Practice with flashcards</p></div><button aria-label="Open flashcards" onClick={() => navigate("/academic/flashcards")} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight size={18}/></button></div>
              </section>
            </aside>
          </div>
        </main>
      </div>

      <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {[
            { label: "Home", path: "/", icon: Compass },
            { label: "Study", path: "/study-mode", icon: Video },
            { label: "Academic", path: "/academic", icon: BookOpen },
            { label: "Play", path: "/multiplayer", icon: Swords },
            { label: "More", path: "/learning-dna", icon: BrainCircuit },
          ].map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => navigate(item.path)} className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${item.label === "Home" ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}><Icon size={19}/>{item.label}</button>; })}
        </div>
      </nav>
    </div>
  );
}
