import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Filter, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuiz } from "@/context/QuizContext";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
import { normalizeGrade } from "@/lib/academicProfile";

const QuizFilter: React.FC = () => {
  const navigate = useNavigate();
  const { quizzes, loading } = useQuiz();
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";
  const [grade, setGrade] = useState<string>(() => upperStudent ? String(normalizeGrade(user?.grade, 9)) : "");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [questionType, setQuestionType] = useState("");

  const [grade, setGrade] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [questionType, setQuestionType] = useState<string>("");
  const [questionCount, setQuestionCount] = useState("10");

  // Available options for filters
  const grades = upperStudent ? ["9", "10", "11", "12"] : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const subjects = ["Mathematics", "Science", "English", "Social Studies", "General Knowledge"];

  const topics: {[key: string]: string[];} = {
    "Mathematics": ["Numbers", "Algebra", "Geometry", "Fractions", "Decimals", "Percentages"],
    "Science": ["Biology", "Chemistry", "Physics", "Earth Science", "Astronomy"],
    "English": ["Grammar", "Vocabulary", "Reading", "Writing", "Literature"],
    "Social Studies": ["History", "Geography", "Civics", "Economics"],
    "General Knowledge": ["Current Affairs", "Sports", "Arts", "Technology"]
  };

  const difficulties = ["Easy", "Medium", "Hard", "Extreme"];
  const questionTypes = ["Multiple Choice", "True/False", "Fill in the Blank", "Matching"];

  const applyFilters = () => {
    const filters = {
      grade,
      subject,
      topic,
      difficulty,
      questionType
    };

    setQuizFilters(filters);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set("count", questionCount);
    navigate(`/quiz?${params.toString()}`);
  };

  const resetFilters = () => {
    setGrade("");
    setSubject("");
    setTopic("");
    setDifficulty("");
    setQuestionType("");
    setQuestionCount("10");
  };

  return (
    <div className={upperStudent ? "tier-upper min-h-screen bg-background text-foreground" : "min-h-screen bg-gray-50"}>
      <header className={upperStudent ? "border-b border-border bg-card px-4 py-3" : "bg-primary px-4 py-3 shadow-md"}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate("/quiz")} className={upperStudent ? "mr-2 text-muted-foreground" : "mr-2 text-white"}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className={upperStudent ? "text-2xl font-bold text-foreground" : "text-2xl font-bold text-white"}>Quiz Filters</h1>
          </div>
          <Button variant="outline" size="sm" onClick={resetFilters} className={upperStudent ? "border-border bg-card text-foreground hover:bg-muted" : "border-white bg-transparent text-white hover:bg-white hover:text-primary"}>
            Reset filters
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Card className="shadow-sm">
            <CardHeader className={upperStudent ? "border-b border-border bg-card text-foreground" : "bg-gradient-to-r from-primary to-accent text-white"}>
              <div className="flex items-center"><Filter className="mr-2 h-5 w-5" /><CardTitle>Choose from available questions</CardTitle></div>
            </CardHeader>
            <CardContent className="space-y-6 p-5 sm:p-6">
              {loading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />Loading approved question sets…</div>
              ) : availableQuizzes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="font-semibold">No approved question sets are currently available{upperStudent ? " for Grades 9–12" : ""}.</p>
                  <p className="mt-2 text-sm text-muted-foreground">The filters will appear when approved quizzes with questions are available for your grade range.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="grade">Grade level</Label>
                      <Select value={grade} onValueChange={(value) => { setGrade(value); setSubject(""); setTopic(""); setDifficulty(""); setQuestionType(""); }}>
                        <SelectTrigger id="grade"><SelectValue placeholder="All available grades" /></SelectTrigger>
                        <SelectContent>{grades.map((value) => <SelectItem key={value} value={value}>Grade {value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Select value={subject} onValueChange={(value) => { setSubject(value); setTopic(""); setQuestionType(""); }}>
                        <SelectTrigger id="subject"><SelectValue placeholder="All available subjects" /></SelectTrigger>
                        <SelectContent>{subjects.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="topic">Topic</Label>
                      <Select value={topic} onValueChange={setTopic} disabled={topics.length === 0}>
                        <SelectTrigger id="topic"><SelectValue placeholder={topics.length ? "All available topics" : "No topics in this selection"} /></SelectTrigger>
                        <SelectContent>{topics.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="difficulty">Difficulty</Label>
                      <Select value={difficulty} onValueChange={setDifficulty} disabled={difficulties.length === 0}>
                        <SelectTrigger id="difficulty"><SelectValue placeholder="All available difficulties" /></SelectTrigger>
                        <SelectContent>{difficulties.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="questionType">Question type</Label>
                      <Select value={questionType} onValueChange={setQuestionType} disabled={questionTypes.length === 0}>
                        <SelectTrigger id="questionType"><SelectValue placeholder="All available question types" /></SelectTrigger>
                        <SelectContent>{questionTypes.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border pt-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Applied filters</h3>
                    <div className="flex flex-wrap gap-2">
                      {grade && <Badge variant="outline">Grade {grade}</Badge>}
                      {subject && <Badge variant="outline">{subject}</Badge>}
                      {topic && <Badge variant="outline">{topic}</Badge>}
                      {difficulty && <Badge variant="outline">{difficulty}</Badge>}
                      {questionType && <Badge variant="outline">{questionType}</Badge>}
                      {!grade && !subject && !topic && !difficulty && !questionType && <span className="text-sm text-muted-foreground">No filters applied — all available question sets will be shown.</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="questionCount">Questions</Label>
                    <Select value={questionCount} onValueChange={setQuestionCount}>
                      <SelectTrigger id="questionCount"><SelectValue placeholder="Select question count" /></SelectTrigger>
                      <SelectContent>{[5, 10, 15, 20].map((count) => <SelectItem key={count} value={String(count)}>{count} Questions</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="pt-4 space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Applied Filters:</h3>
                  <div className="flex flex-wrap gap-2">
                    {grade &&
                    <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300">
                        Grade: {grade}
                      </Badge>
                    }
                    {subject &&
                    <Badge variant="outline" className="bg-green-50 text-green-800 border-green-300">
                        Subject: {subject}
                      </Badge>
                    }
                    {topic &&
                    <Badge variant="outline" className="bg-primary text-primary border-primary">
                        Topic: {topic}
                      </Badge>
                    }
                    {difficulty &&
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                        Difficulty: {difficulty}
                      </Badge>
                    }
                    {questionType &&
                    <Badge variant="outline" className="bg-red-50 text-red-800 border-red-300">
                        Type: {questionType}
                      </Badge>
                    }
                    {!grade && !subject && !topic && !difficulty && !questionType &&
                    <span className="text-gray-500 text-sm">No filters applied</span>
                    }
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default QuizFilter;
