import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, AlertTriangle, BookOpen, Brain, Target } from "lucide-react";

interface TopicData {
  subject: string;
  topic: string;
  accuracy_percentage: number;
  completion_percentage: number;
  questions_attempted: number;
  questions_correct: number;
}

const SUBJECT_CONFIG: Record<string, { color: string; icon: string }> = {
  math: { color: "from-indigo-500 to-purple-600", icon: "🔢" },
  science: { color: "from-green-500 to-emerald-600", icon: "🔬" },
  english: { color: "from-blue-500 to-cyan-600", icon: "📝" },
  history: { color: "from-amber-500 to-orange-600", icon: "📜" },
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
      const { data, error } = await supabase
        .from("topic_progress")
        .select("*")
        .eq("user_id", user.id);
      if (data) setTopics(data);
      setIsLoading(false);
    };
    fetchTopics();
  }, [user]);

  const subjects = Object.keys(SUBJECT_CONFIG);
  const filteredTopics = selectedSubject ? topics.filter(t => t.subject === selectedSubject) : topics;
  const weakTopics = topics.filter(t => t.accuracy_percentage < 60 && t.questions_attempted > 0).sort((a, b) => a.accuracy_percentage - b.accuracy_percentage);

  const getSubjectStats = (subject: string) => {
    const subTopics = topics.filter(t => t.subject === subject);
    if (subTopics.length === 0) return { avgAccuracy: 0, totalAttempted: 0, topicCount: 0 };
    const avgAccuracy = subTopics.reduce((s, t) => s + t.accuracy_percentage, 0) / subTopics.length;
    const totalAttempted = subTopics.reduce((s, t) => s + t.questions_attempted, 0);
    return { avgAccuracy: Math.round(avgAccuracy), totalAttempted, topicCount: subTopics.length };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-emerald-700 to-teal-700 px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/academic")} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Topic Coverage
            </h1>
            <p className="text-xs text-white/60">{topics.length} topics tracked</p>
          </div>
        </div>
      </header>

      {/* Weak Topics Alert */}
      {weakTopics.length > 0 && (
        <div className="px-4 py-4 max-w-4xl mx-auto">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h3 className="font-semibold text-sm">Weak Topics ({weakTopics.length})</h3>
              </div>
              <div className="space-y-2">
                {weakTopics.slice(0, 3).map(t => (
                  <div key={`${t.subject}-${t.topic}`} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{t.topic} <span className="text-xs text-muted-foreground">({t.subject})</span></span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-destructive font-medium">{Math.round(t.accuracy_percentage)}%</span>
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => navigate(`/quiz?subject=${t.subject}`)}>
                        Practice
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subject Tabs */}
      <div className="px-4 max-w-4xl mx-auto">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
          <Button
            variant={!selectedSubject ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSubject(null)}
          >
            All
          </Button>
          {subjects.map(s => (
            <Button
              key={s}
              variant={selectedSubject === s ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSubject(s)}
              className="capitalize"
            >
              {SUBJECT_CONFIG[s].icon} {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Subject Overview */}
      {!selectedSubject && (
        <div className="px-4 py-4 max-w-4xl mx-auto grid grid-cols-2 gap-3">
          {subjects.map((s, i) => {
            const stats = getSubjectStats(s);
            return (
              <motion.div key={s} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="cursor-pointer hover:shadow-lg transition-all border-border/50" onClick={() => setSelectedSubject(s)}>
                  <CardContent className="p-4">
                    <div className="text-2xl mb-2">{SUBJECT_CONFIG[s].icon}</div>
                    <h3 className="font-semibold capitalize text-sm">{s}</h3>
                    <p className="text-xs text-muted-foreground">{stats.topicCount} topics • {stats.totalAttempted} questions</p>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Accuracy</span>
                        <span className="font-medium">{stats.avgAccuracy}%</span>
                      </div>
                      <Progress value={stats.avgAccuracy} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Topic List */}
      {selectedSubject && (
        <div className="px-4 py-4 pb-24 max-w-4xl mx-auto space-y-2">
          {filteredTopics.length === 0 ? (
            <Card className="bg-card/80 border-border/50">
              <CardContent className="p-8 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No topic data yet. Take some quizzes to track your progress!</p>
                <Button className="mt-4" onClick={() => navigate(`/quiz?subject=${selectedSubject}`)}>
                  Start Quiz
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredTopics.map((t, i) => (
              <motion.div key={`${t.subject}-${t.topic}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="bg-card/80 border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm capitalize">{t.topic}</h4>
                      <Badge variant={t.accuracy_percentage >= 80 ? "default" : t.accuracy_percentage >= 50 ? "secondary" : "destructive"} className="text-xs">
                        {Math.round(t.accuracy_percentage)}%
                      </Badge>
                    </div>
                    <Progress value={t.accuracy_percentage} className="h-2 mb-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t.questions_correct}/{t.questions_attempted} correct</span>
                      <span>{Math.round(t.completion_percentage)}% covered</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TopicCoveragePage;
