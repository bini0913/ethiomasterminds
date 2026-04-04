import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, Lock, CheckCircle, Star, Zap, BookOpen, Trophy } from "lucide-react";

interface TopicData {
  subject: string;
  topic: string;
  accuracy_percentage: number;
  completion_percentage: number;
  questions_attempted: number;
  questions_correct: number;
}

const SUBJECT_CONFIG: Record<string, { gradient: string; icon: string; bgColor: string }> = {
  math: { gradient: "from-indigo-500 to-purple-600", icon: "🔢", bgColor: "bg-indigo-500/10" },
  science: { gradient: "from-green-500 to-emerald-600", icon: "🔬", bgColor: "bg-green-500/10" },
  english: { gradient: "from-blue-500 to-cyan-600", icon: "📝", bgColor: "bg-blue-500/10" },
  history: { gradient: "from-amber-500 to-orange-600", icon: "📜", bgColor: "bg-amber-500/10" },
};

// Define learning path for each subject
const LEARNING_PATHS: Record<string, string[]> = {
  math: ["Numbers & Operations", "Algebra Basics", "Linear Equations", "Quadratic Equations", "Functions", "Trigonometry", "Matrices", "Calculus Intro", "Derivatives", "Integration", "Sequences & Series", "Probability", "Statistics", "Vectors", "Complex Numbers"],
  science: ["Mechanics", "Thermodynamics", "Waves & Sound", "Optics", "Electricity", "Magnetism", "Nuclear Physics", "Atomic Structure", "Chemical Bonding", "Stoichiometry", "Acids & Bases", "Organic Chemistry", "Cell Biology", "Genetics", "Ecology"],
  english: ["Parts of Speech", "Tenses", "Active & Passive Voice", "Conditionals", "Clauses", "Vocabulary Building", "Reading Comprehension", "Essay Writing", "Literature Basics", "Figures of Speech", "Critical Analysis", "Paragraph Development", "Summary Writing", "Debate Skills", "Research Writing"],
  history: ["Ancient Civilizations", "Aksumite Empire", "Zagwe Dynasty", "Solomonic Dynasty", "Zemene Mesafint", "Emperor Tewodros II", "Battle of Adwa", "Italian Occupation", "Haile Selassie Era", "The Derg", "EPRDF Period", "Ethiopian Constitution", "Civics & Governance", "Pan-Africanism", "Modern Ethiopia"],
};

const TopicCoveragePage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchTopics = async () => {
      const { data } = await supabase
        .from("topic_progress")
        .select("*")
        .eq("user_id", user.id);
      if (data) setTopics(data);
      setIsLoading(false);
    };
    fetchTopics();
  }, [user]);

  const getTopicStatus = (subject: string, topicName: string) => {
    const match = topics.find(
      (t) => t.subject === subject && t.topic.toLowerCase() === topicName.toLowerCase()
    );
    if (!match) return { status: "locked" as const, accuracy: 0, attempted: 0 };
    if (match.accuracy_percentage >= 80 && match.questions_attempted >= 5)
      return { status: "mastered" as const, accuracy: match.accuracy_percentage, attempted: match.questions_attempted };
    if (match.questions_attempted > 0)
      return { status: "in_progress" as const, accuracy: match.accuracy_percentage, attempted: match.questions_attempted };
    return { status: "locked" as const, accuracy: 0, attempted: 0 };
  };

  const getSubjectProgress = (subject: string) => {
    const path = LEARNING_PATHS[subject] || [];
    let completed = 0;
    path.forEach((t) => {
      const s = getTopicStatus(subject, t);
      if (s.status === "mastered") completed++;
    });
    return { completed, total: path.length, pct: path.length > 0 ? Math.round((completed / path.length) * 100) : 0 };
  };

  // Determine which topics are unlocked (sequential unlocking)
  const isTopicUnlocked = (subject: string, index: number) => {
    if (index === 0) return true; // first always unlocked
    const path = LEARNING_PATHS[subject] || [];
    // Check if any topic has progress - if so, unlock based on previous completion
    const subjectTopics = topics.filter((t) => t.subject === subject);
    if (subjectTopics.length === 0 && index <= 2) return true; // unlock first 3 if no progress
    if (index <= 2) return true; // always unlock first 3
    const prevTopic = path[index - 1];
    const prevStatus = getTopicStatus(subject, prevTopic);
    return prevStatus.status !== "locked";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Subject selection view
  if (!selectedSubject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <header className="sticky top-0 z-50 bg-gradient-to-r from-emerald-700 to-teal-700 px-4 py-3 shadow-xl">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate("/academic")} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Learning Path
              </h1>
              <p className="text-xs text-white/60">Master topics step by step</p>
            </div>
          </div>
        </header>

        {/* Overall XP Card */}
        <div className="px-4 py-4 max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Total Mastery</p>
                  <p className="text-xs text-muted-foreground">
                    {Object.keys(SUBJECT_CONFIG).reduce((sum, s) => sum + getSubjectProgress(s).completed, 0)} / {Object.keys(SUBJECT_CONFIG).reduce((sum, s) => sum + getSubjectProgress(s).total, 0)} topics mastered
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{user?.xp || 0}</p>
                  <p className="text-xs text-muted-foreground">XP</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subject Cards */}
        <div className="px-4 pb-24 max-w-4xl mx-auto space-y-3">
          {Object.entries(SUBJECT_CONFIG).map(([subject, config], i) => {
            const progress = getSubjectProgress(subject);
            return (
              <motion.div
                key={subject}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-lg transition-all border-border/50 bg-card/80 overflow-hidden"
                  onClick={() => setSelectedSubject(subject)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-stretch">
                      <div className={`w-2 bg-gradient-to-b ${config.gradient}`} />
                      <div className="flex-1 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{config.icon}</span>
                            <div>
                              <h3 className="font-bold capitalize text-base">{subject}</h3>
                              <p className="text-xs text-muted-foreground">{progress.completed}/{progress.total} topics mastered</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={progress.pct >= 80 ? "default" : "secondary"} className="text-xs">
                              {progress.pct}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={progress.pct} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // Learning Path View (Duolingo-style road)
  const path = LEARNING_PATHS[selectedSubject] || [];
  const config = SUBJECT_CONFIG[selectedSubject] || SUBJECT_CONFIG.math;
  const subProgress = getSubjectProgress(selectedSubject);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-emerald-700 to-teal-700 px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => setSelectedSubject(null)} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white capitalize flex items-center gap-2">
              {config.icon} {selectedSubject} Path
            </h1>
            <p className="text-xs text-white/60">{subProgress.completed}/{subProgress.total} mastered</p>
          </div>
          <Badge variant="outline" className="text-white border-white/30">{subProgress.pct}%</Badge>
        </div>
      </header>

      <div className="px-4 py-2 max-w-4xl mx-auto">
        <Progress value={subProgress.pct} className="h-2" />
      </div>

      {/* Learning Road */}
      <div className="px-4 py-4 pb-24 max-w-md mx-auto">
        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-8 top-0 bottom-0 w-1 bg-border/50 rounded-full" />

          {path.map((topicName, i) => {
            const topicStatus = getTopicStatus(selectedSubject, topicName);
            const unlocked = isTopicUnlocked(selectedSubject, i);
            const isMastered = topicStatus.status === "mastered";
            const isInProgress = topicStatus.status === "in_progress";
            const isLocked = !unlocked;

            // Zigzag offset
            const offset = i % 2 === 0 ? "ml-0" : "ml-8";

            return (
              <motion.div
                key={topicName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`relative mb-4 ${offset}`}
              >
                {/* Node circle */}
                <div className="absolute left-5 top-4 z-10">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-md transition-all ${
                      isMastered
                        ? "bg-green-500 border-green-400 text-white"
                        : isInProgress
                        ? "bg-yellow-500 border-yellow-400 text-white animate-pulse"
                        : isLocked
                        ? "bg-muted border-border text-muted-foreground"
                        : "bg-primary/20 border-primary text-primary"
                    }`}
                  >
                    {isMastered ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : isInProgress ? (
                      <Zap className="h-3.5 w-3.5" />
                    ) : isLocked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Star className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>

                {/* Topic Card */}
                <div className="pl-16">
                  <Card
                    className={`transition-all border-border/50 ${
                      isMastered
                        ? "bg-green-500/5 border-green-500/20 shadow-sm"
                        : isInProgress
                        ? "bg-yellow-500/5 border-yellow-500/20 shadow-md hover:shadow-lg cursor-pointer"
                        : isLocked
                        ? "bg-muted/30 opacity-50"
                        : "bg-card/80 hover:shadow-lg cursor-pointer hover:-translate-y-0.5"
                    }`}
                    onClick={() => {
                      if (!isLocked) navigate(`/quiz?subject=${selectedSubject}`);
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                            <h4 className={`text-sm font-semibold truncate ${isLocked ? "text-muted-foreground" : ""}`}>
                              {topicName}
                            </h4>
                          </div>
                          {isInProgress && (
                            <div className="mt-1.5">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{topicStatus.attempted} questions</span>
                                <span>•</span>
                                <span className={topicStatus.accuracy >= 80 ? "text-green-600" : topicStatus.accuracy >= 50 ? "text-yellow-600" : "text-red-500"}>
                                  {Math.round(topicStatus.accuracy)}% accuracy
                                </span>
                              </div>
                              <Progress value={topicStatus.accuracy} className="h-1 mt-1" />
                            </div>
                          )}
                          {isMastered && (
                            <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Mastered • {Math.round(topicStatus.accuracy)}%
                            </p>
                          )}
                        </div>
                        {!isLocked && !isMastered && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 shrink-0">
                            <BookOpen className="h-3 w-3 mr-1" /> Practice
                          </Button>
                        )}
                        {isMastered && (
                          <div className="text-xl">⭐</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            );
          })}

          {/* End trophy */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: path.length * 0.06 }}
            className="flex justify-center pt-4"
          >
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-xl`}>
              <Trophy className="h-8 w-8 text-white" />
            </div>
          </motion.div>
          <p className="text-center text-sm text-muted-foreground mt-2 font-medium">
            {subProgress.pct >= 100 ? "🎉 Path Complete!" : `${subProgress.total - subProgress.completed} topics remaining`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TopicCoveragePage;
