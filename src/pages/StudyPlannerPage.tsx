import React, { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Plus, Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";

interface StudyPlan {
  id: string;
  subject: string;
  topic: string;
  scheduled_date: string;
  completed: boolean;
  priority: string;
}

const StudyPlannerPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newPriority, setNewPriority] = useState("medium");
  const [subjects, setSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchPlans();
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`study-plans-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_plans', filter: `user_id=eq.${user.id}` }, () => fetchPlans())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchPlans = async () => {
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

    if (error) {
      console.error(error);
      toast.error("Failed to load study plans");
    }

    if (data) {
      setPlans(data);
      let dbSubjects = Array.from(new Set(data.map((plan) => plan.subject))).sort();
      if (dbSubjects.length === 0) {
        const { data: flashcardSubjects } = await supabase.from('flashcards').select('subject');
        dbSubjects = Array.from(new Set((flashcardSubjects || []).map((card) => card.subject))).sort();
      }
      setSubjects(dbSubjects);
      if (!newSubject && dbSubjects.length > 0) {
        setNewSubject(dbSubjects[0]);
      }
    }
    setIsLoading(false);
  };

  const addPlan = async () => {
    const auth = await supabase.auth.getUser();
    if (!user || !auth.data.user?.id || !newTopic.trim() || !newSubject) {
      toast.error("Please enter a topic");
      return;
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
    const { error } = await supabase
      .from("study_plans")
      .update({ completed: !plan.completed })
      .eq("id", plan.id);
    if (error) { toast.error("Failed to update"); return; }
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, completed: !p.completed } : p));
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("study_plans").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Failed to delete plan");
      return;
    }
    await fetchPlans();
  };

  const todayPlans = plans.filter(p => isSameDay(new Date(p.scheduled_date), new Date()));
  const completedToday = todayPlans.filter(p => p.completed).length;

  // Group plans by date
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
              <Calendar className="h-5 w-5" /> Study Planner
            </h1>
            <p className="text-xs text-white/60">
              Today: {completedToday}/{todayPlans.length} completed
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </header>

      {/* Today's Progress */}
      {todayPlans.length > 0 && (
        <div className="px-4 py-4 max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Today's Goals</h3>
                <Badge variant={completedToday === todayPlans.length ? "default" : "secondary"}>
                  {completedToday}/{todayPlans.length}
                </Badge>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${todayPlans.length > 0 ? (completedToday / todayPlans.length) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Plan Form */}
      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="px-4 max-w-4xl mx-auto mb-4">
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

      {/* Plans by Date */}
      <div className="px-4 pb-24 max-w-4xl mx-auto space-y-4">
        {Object.keys(grouped).length === 0 ? (
          <Card className="bg-card/80">
            <CardContent className="p-8 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No study plans yet. Create your first one!</p>
              <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Create Plan</Button>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                {isSameDay(new Date(date), new Date()) ? "📍 Today" : format(new Date(date), "EEE, MMM d")}
              </h3>
              <div className="space-y-2">
                {items.map(plan => (
                  <motion.div key={plan.id} layout>
                    <Card className={`bg-card/80 border-border/50 ${plan.completed ? "opacity-60" : ""}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 rounded-full ${plan.completed ? "bg-green-500/20 text-green-600" : "bg-secondary"}`}
                          onClick={() => toggleComplete(plan)}
                        >
                          {plan.completed ? <Check className="h-4 w-4" /> : <div className="w-4 h-4 rounded-full border-2" />}
                        </Button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium capitalize ${plan.completed ? "line-through" : ""}`}>{plan.topic}</p>
                          <p className="text-xs text-muted-foreground capitalize">{plan.subject}</p>
                        </div>
                        <Badge variant={plan.priority === "high" ? "destructive" : plan.priority === "medium" ? "secondary" : "outline"} className="text-xs">
                          {plan.priority}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePlan(plan.id)}>
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
