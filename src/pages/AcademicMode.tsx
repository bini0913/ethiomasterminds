import React from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  BookOpen, Brain, Target, Calendar, BarChart3, 
  ArrowLeft, GraduationCap, Sparkles, TrendingUp
} from "lucide-react";

const AcademicMode: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  // Grade values have historically been stored both as "8" and "Grade 8".\n  // Normalize both formats so valid middle/high-school students are not blocked.\n  const gradeValue = (user?.grade || "").trim();\n  const gradeMatch = gradeValue.match(/(?:grade\\s*)?(\\d{1,2})/i);\n  const gradeNum = gradeMatch ? Number(gradeMatch[1]) : 0;\n  const isEligibleGrade = gradeNum >= 5 && gradeNum <= 12;

  if (!isEligibleGrade) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Academic Mode</h2>
            <p className="text-muted-foreground mb-4">
              Academic Mode is available for Grades 5–12. Update your grade in Settings to access this feature.
            </p>
            <Button onClick={() => navigate("/settings")}>Go to Settings</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const features = [
    {
      title: "Flashcards",
      description: "Smart study with spaced repetition",
      icon: <BookOpen className="h-7 w-7" />,
      path: "/academic/flashcards",
      color: "from-blue-600 to-indigo-600",
      badge: "🔥"
    },
    {
      title: "Topic Coverage",
      description: "Track your mastery by topic",
      icon: <BarChart3 className="h-7 w-7" />,
      path: "/academic/topics",
      color: "from-emerald-600 to-teal-600",
      badge: "📊"
    },
    {
      title: "Exam Mode",
      description: "Timed mock exams",
      icon: <Target className="h-7 w-7" />,
      path: "/academic/exam",
      color: "from-red-600 to-rose-600",
      badge: "📝"
    },
    {
      title: "Study Planner",
      description: "Weekly schedule & daily goals",
      icon: <Calendar className="h-7 w-7" />,
      path: "/academic/planner",
      color: "from-amber-600 to-orange-600",
      badge: "📅"
    },
    {
      title: "AI Study Coach",
      description: "Personalized recommendations",
      icon: <Brain className="h-7 w-7" />,
      path: "/ai-tutor",
      color: "from-violet-600 to-purple-600",
      badge: "🧠"
    },
    {
      title: "Academic Insights",
      description: "Performance trends & analytics",
      icon: <TrendingUp className="h-7 w-7" />,
      path: "/academic/insights",
      color: "from-sky-600 to-cyan-600",
      badge: "📈"
    },
  ];

  const academicRank = getAcademicRank(user?.xp || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900 px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <GraduationCap className="h-5 w-5" /> Academic Mode
            </h1>
            <p className="text-xs text-white/60">Grade {user?.grade} • {academicRank.title}</p>
          </div>
          <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1">
            <Sparkles className="h-3 w-3 text-yellow-400" />
            <span className="text-xs text-white font-medium">{academicRank.title}</span>
          </div>
        </div>
      </header>

      {/* Academic Rank Card */}
      <div className="px-4 py-4 max-w-4xl mx-auto">
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-card/80 backdrop-blur-sm rounded-2xl p-4 border border-border/50 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Academic Rank</p>
              <h3 className="text-lg font-bold">{academicRank.emoji} {academicRank.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {academicRank.nextXP > 0 ? `${academicRank.nextXP - (user?.xp || 0)} XP to next rank` : "Max rank achieved!"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{user?.xp || 0}</p>
              <p className="text-xs text-muted-foreground">Total XP</p>
            </div>
          </div>
          {academicRank.nextXP > 0 && (
            <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(((user?.xp || 0) / academicRank.nextXP) * 100, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          )}
        </motion.div>
      </div>

      {/* Feature Grid */}
      <div className="px-4 pb-24 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card
                className="h-full cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden group"
                onClick={() => navigate(feature.path)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                      {feature.icon}
                    </div>
                    <span className="text-xl">{feature.badge}</span>
                  </div>
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

function getAcademicRank(xp: number) {
  if (xp >= 10000) return { title: "Elite Scholar", emoji: "🏆", nextXP: 0 };
  if (xp >= 5000) return { title: "Gold Scholar", emoji: "🥇", nextXP: 10000 };
  if (xp >= 2000) return { title: "Silver Scholar", emoji: "🥈", nextXP: 5000 };
  if (xp >= 500) return { title: "Bronze Scholar", emoji: "🥉", nextXP: 2000 };
  return { title: "Aspiring Scholar", emoji: "📖", nextXP: 500 };
}

export default AcademicMode;
