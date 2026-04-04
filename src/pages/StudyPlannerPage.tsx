import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, Plus, Check, X, Sparkles, Brain, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";

interface StudyPlan {
  id: string;
  subject: string;
  topic: string;
  scheduled_date: string;
  completed: boolean;
  priority: string;
  notes: string | null;
}

const StudyPlannerPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newSubject, setNewSubject] = useState("math");
  const [newTopic, setNewTopic] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newPriority, setNewPriority] = useState("medium");

  const subjects = ["math", "science", "english", "history"];

  const fetchPlans = useCallback(async () => {
    const auth = await supabase.auth.getUser();
    if (!user || !auth.data.user?.id) return;
    const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
    const weekEnd = format(addDays(startOfWeek(new Date()), 13), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", auth.data.user.id)
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd)
      .order("scheduled_date");

    if (error) { console.error(error); toast.error("Failed to load study plans"); }
    if (data) setPlans(data);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { if (user) fetchPlans(); }, [fetchPlans, user]);

  const addPlan = async () => {
    const auth = await supabase.auth.getUser();
    if (!user || !auth.data.user?.id || !newTopic.trim()) {
      toast.error("Please enter a topic"); return;
    }
    const { error } = await supabase.from("study_plans").insert({
      user_id: auth.data.user.id,
      subject: newSubject,
      topic: newTopic.trim(),
      scheduled_date: newDate,
      priority: newPriority,
    });
    if (error) { toast.error("Failed to add plan"); return; }
    toast.success("Study plan added!");
    setShowAdd(false);
    setNewTopic("");
    fetchPlans();
  };

  const toggleComplete = async (plan: StudyPlan) => {
    const { error } = await supabase.from("study_plans").update({ completed: !plan.completed }).eq("id", plan.id);
    if (error) { toast.error("Failed to update"); return; }
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, completed: !p.completed } : p));

    if (!plan.completed && user) {
      supabase.rpc("add_xp", { p_user_id: user.id, p_amount: 10 });
      toast.success("+10 XP for completing a study task!");
    }
  };

  const deletePlan = async (id: string) => {
    await supabase.from("study_plans").delete().eq("id", id);
    fetchPlans();
  };

  const generateAIPlan = async () => {
    if (!user) return;
    setIsGenerating(true);

    try {
      // Fetch weak areas from analytics and topic progress
      const [analyticsRes, topicRes] = await Promise.all([
        supabase.from("analytics").select("subject, accuracy, total_questions_attempted").eq("user_id", user.id),
        supabase.from("topic_progress").select("subject, topic, accuracy_percentage, questions_attempted").eq("user_id", user.id).order("accuracy_percentage", { ascending: true }).limit(20),
      ]);

      const weakTopics = (topicRes.data || []).filter(t => t.accuracy_percentage < 70);
      const analytics = analyticsRes.data || [];

      // Call AI edge function
      const { data: aiData, error: aiError } = await supabase.functions.invoke("ai-study-planner", {
        body: {
          weakTopics,
          analytics,
          grade: user.grade || "12",
          existingPlans: plans.map(p => ({ subject: p.subject, topic: p.topic, scheduled_date: p.scheduled_date })),
        },
      });

      if (aiError) throw aiError;

      const suggestions: Array<{ subject: string; topic: string; priority: string; day_offset: number; notes: string }> = aiData?.suggestions || [];

      if (suggestions.length === 0) {
        // Fallback: generate based on weak topics
        const fallbackPlans = generateFallbackPlan(weakTopics, analytics);
        await insertPlans(fallbackPlans);
      } else {
        const auth = await supabase.auth.getUser();
        if (!auth.data.user?.id) return;
        const today = new Date();
        const inserts = suggestions.map((s) => ({
          user_id: auth.data.user!.id,
          subject: s.subject,
          topic: s.topic,
          scheduled_date: format(addDays(today, s.day_offset || 0), "yyyy-MM-dd"),
          priority: s.priority || "medium",
          notes: s.notes || "AI recommended",
        }));
        await supabase.from("study_plans").insert(inserts);
        toast.success(`✨ AI generated ${inserts.length} study tasks!`);
        fetchPlans();
      }
    } catch (e) {
      console.error("AI planner error:", e);
      // Fallback to smart generation
      const [topicRes, analyticsRes] = await Promise.all([
        supabase.from("topic_progress").select("*").eq("user_id", user.id).order("accuracy_percentage", { ascending: true }).limit(10),
        supabase.from("analytics").select("*").eq("user_id", user.id),
      ]);
      const fallbackPlans = generateFallbackPlan(topicRes.data || [], analyticsRes.data || []);
      await insertPlans(fallbackPlans);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFallbackPlan = (weakTopics: any[], analytics: any[]) => {
    const plans: Array<{ subject: string; topic: string; priority: string; day_offset: number; notes: string }> = [];
    const today = new Date();

    // Identify weak subjects
    const subjectAccuracy: Record<string, number> = {};
    analytics.forEach(a => { subjectAccuracy[a.subject] = a.accuracy || 0; });

    // Add weak topics first
    weakTopics.slice(0, 5).forEach((t, i) => {
      plans.push({
        subject: t.subject,
        topic: `Review: ${t.topic} (${Math.round(t.accuracy_percentage)}% accuracy)`,
        priority: t.accuracy_percentage < 40 ? "high" : "medium",
        day_offset: i,
        notes: "Focus on understanding core concepts",
      });
    });

    // Fill remaining days with subject rotation
    const allSubjects = ["math", "science", "english", "history"];
    for (let i = plans.length; i < 7; i++) {
      const subj = allSubjects[i % allSubjects.length];
      plans.push({
        subject: subj,
        topic: `Practice ${subj} problems`,
        priority: (subjectAccuracy[subj] || 50) < 60 ? "high" : "low",
        day_offset: i,
        notes: "Daily practice session",
      });
    }

    return plans;
  };

  const insertPlans = async (generatedPlans: Array<{ subject: string; topic: string; priority: string; day_offset: number; notes: string }>) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id) return;
    const today = new Date();
    const inserts = generatedPlans.map((p) => ({
      user_id: auth.data.user!.id,
      subject: p.subject,
      topic: p.topic,
      scheduled_date: format(addDays(today, p.day_offset), "yyyy-MM-dd"),
      priority: p.priority,
      notes: p.notes,
    }));
    await supabase.from("study_plans").insert(inserts);
    toast.success(`📚 Generated ${inserts.length} study tasks based on your weak areas!`);
    fetchPlans();
  };

  const todayPlans = plans.filter(p => isSameDay(new Date(p.scheduled_date), new Date()));
  const completedToday = todayPlans.filter(p => p.completed).length;

  const grouped = plans.reduce<Record<string, StudyPlan[]>>((acc, p) => {
    (acc[p.scheduled_date] = acc[p.scheduled_date] || []).push(p);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-amber-700 to-orange-700 px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/academic")} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5" /> AI Study Planner
            </h1>
            <p className="text-xs text-white/60">Today: {completedToday}/{todayPlans.length} completed</p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* AI Generate Button */}
      <div className="px-4 py-4 max-w-4xl mx-auto">
        <Button
          className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700"
          onClick={generateAIPlan}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Analyzing your weak areas...</>
          ) : (
            <><Wand2 className="h-5 w-5 mr-2" /> Generate AI Study Plan</>
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-1">
          AI analyzes your quiz results & weak topics to create a personalized plan
        </p>
      </div>

      {/* Today's Progress */}
      {todayPlans.length > 0 && (
        <div className="px-4 max-w-4xl mx-auto mb-4">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Today's Goals
                </h3>
                <Badge variant={completedToday === todayPlans.length ? "default" : "secondary"}>
                  {completedToday}/{todayPlans.length}
                </Badge>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <motion.div
                  className="bg-primary h-2.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${todayPlans.length > 0 ? (completedToday / todayPlans.length) * 100 : 0}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Plan Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-4 max-w-4xl mx-auto mb-4">
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Select value={newSubject} onValueChange={setNewSubject}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Topic (e.g., Algebra)" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addPlan} className="flex-1">Add Plan</Button>
                  <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plans by Date */}
      <div className="px-4 pb-24 max-w-4xl mx-auto space-y-4">
        {Object.keys(grouped).length === 0 ? (
          <Card className="bg-card/80">
            <CardContent className="p-8 text-center">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">No study plans yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Use AI to generate a personalized plan or add tasks manually</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={generateAIPlan} disabled={isGenerating} className="bg-gradient-to-r from-violet-600 to-purple-600">
                  <Wand2 className="h-4 w-4 mr-1" /> AI Generate
                </Button>
                <Button variant="outline" onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Manual
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                {isSameDay(new Date(date), new Date()) ? "📍 Today" : format(new Date(date), "EEE, MMM d")}
                <Badge variant="outline" className="text-xs">{items.filter(p => p.completed).length}/{items.length}</Badge>
              </h3>
              <div className="space-y-2">
                {items.map(plan => (
                  <motion.div key={plan.id} layout>
                    <Card className={`bg-card/80 border-border/50 transition-all ${plan.completed ? "opacity-60" : ""}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 rounded-full shrink-0 ${plan.completed ? "bg-green-500/20 text-green-600" : "bg-secondary"}`}
                          onClick={() => toggleComplete(plan)}
                        >
                          {plan.completed ? <Check className="h-4 w-4" /> : <div className="w-4 h-4 rounded-full border-2" />}
                        </Button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${plan.completed ? "line-through text-muted-foreground" : ""}`}>{plan.topic}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground capitalize">{plan.subject}</span>
                            {plan.notes && <span className="text-xs text-primary/70">• {plan.notes}</span>}
                          </div>
                        </div>
                        <Badge variant={plan.priority === "high" ? "destructive" : plan.priority === "medium" ? "secondary" : "outline"} className="text-xs shrink-0">
                          {plan.priority}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deletePlan(plan.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudyPlannerPage;
