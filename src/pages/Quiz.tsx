import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useQuiz, Quiz as QuizType, Question } from "@/context/QuizContext";
import QuizView from "@/components/quiz/QuizView";
import { useUser } from "@/context/UserContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, Calculator, Atom, BookOpen, Brain, Zap, Trophy, Target, Play, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import AIHelper from "@/components/ai/AIHelper";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import BackButton from "@/components/ui/BackButton";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const Quiz: React.FC = () => {
  const { quizzes } = useQuiz();
  const { user } = useUser();
  const [activeQuiz, setActiveQuiz] = useState<QuizType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>("5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [activeTab, setActiveTab] = useState<string>("browse");
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [askedQuestions, setAskedQuestions] = useState<Set<string>>(new Set());
  const [attemptedQuestionIds, setAttemptedQuestionIds] = useState<Set<string>>(new Set());
  const [completedQuizIds, setCompletedQuizIds] = useState<Set<string>>(new Set());
  const [allowXPForActiveQuiz, setAllowXPForActiveQuiz] = useState(true);
  
  useEffect(() => {
    const preferredGrade = parseInt(user?.grade || "5", 10);
    const boundedGrade = Number.isNaN(preferredGrade) ? 5 : Math.min(9, Math.max(5, preferredGrade));
    setSelectedGrade(boundedGrade.toString());
  }, [user?.grade]);

  const studentGrade = useMemo(() => {
    const preferredGrade = parseInt(user?.grade || "5", 10);
    return Number.isNaN(preferredGrade) ? 5 : Math.min(9, Math.max(5, preferredGrade));
  }, [user?.grade]);

  const selectedGradeNumber = useMemo(() => {
    const parsed = parseInt(selectedGrade, 10);
    return Number.isNaN(parsed) ? studentGrade : Math.min(9, Math.max(5, parsed));
  }, [selectedGrade, studentGrade]);

  const normalizeCategory = (value: string) => value.toLowerCase().trim();
  const rotateOptionsForBalance = (question: Question, quizIndexSeed: number, questionIndex: number): Question => {
    if (question.type !== "Multiple Choice") return question;

    const options = question.options.slice(0, 4);
    if (options.length < 2 || !options.includes(question.correctAnswer)) return question;

    const shift = (quizIndexSeed + questionIndex) % options.length;
    if (shift === 0) return question;

    const rotatedOptions = options.map((_, idx) => options[(idx + shift) % options.length]);
    return {
      ...question,
      options: rotatedOptions,
    };
  };

  const categories = useMemo(
    () => [...new Set(
      quizzes
        .filter((quiz) => quiz.gradeLevel === selectedGradeNumber)
        .map((quiz) => quiz.category)
    )],
    [quizzes, selectedGradeNumber]
  );

  // Create 10 practice sets per grade+subject with 10 questions each.
  const generatedPracticeQuizzes = useMemo(() => {
    const grade = selectedGradeNumber;
    if (Number.isNaN(grade)) return [];

    const quizzesByCategory = new Map<string, QuizType[]>();
    quizzes
      .filter((quiz) => quiz.gradeLevel === grade)
      .forEach((quiz) => {
        if (!quizzesByCategory.has(quiz.category)) quizzesByCategory.set(quiz.category, []);
        quizzesByCategory.get(quiz.category)!.push(quiz);
      });

    const buildSet = (subjectQuizzes: QuizType[], category: string, questionCount: number, index: number): QuizType => {
      const dedupedQuestions = new Map<string, Question>();
      subjectQuizzes.forEach((quiz) => {
        quiz.questions.forEach((question) => dedupedQuestions.set(question.id, question));
      });
      const pool = Array.from(dedupedQuestions.values());
      const fallbackOptions = [
        `Choice 1 for Grade ${grade} ${category}`,
        `Choice 2 for Grade ${grade} ${category}`,
        `Choice 3 for Grade ${grade} ${category}`,
        `Choice 4 for Grade ${grade} ${category}`,
      ];
      const fallbackQuestion: Question = {
        id: `fallback-${category.toLowerCase().replace(/\s+/g, "-")}-g${grade}-q${index + 1}`,
        text: `Grade ${grade} ${category}: Practice question ${index + 1}`,
        options: fallbackOptions,
        correctAnswer: fallbackOptions[index % fallbackOptions.length],
        difficulty: "Medium",
        subject: category,
        grade,
        topic: "General",
        type: "Multiple Choice",
        points: 10,
        explanation: "Use this as guided practice and replace with curriculum-aligned content."
      };
      const offset = (index * questionCount) % Math.max(pool.length, 1);
      const selectedQuestions = Array.from({ length: questionCount }, (_, pickIndex) => {
        if (pool.length === 0) return fallbackQuestion;
        const question = pool[(offset + pickIndex) % pool.length];
        const baseQuestion = question || fallbackQuestion;
        return rotateOptionsForBalance(baseQuestion, index, pickIndex);
      });
      const avgPoints = selectedQuestions.reduce((acc, q) => acc + (q.points || 10), 0) / Math.max(selectedQuestions.length, 1);
      const quizDifficulty: QuizType["difficulty"] = avgPoints >= 15 ? "Hard" : avgPoints >= 10 ? "Medium" : "Easy";
      const sourceQuizId = subjectQuizzes[0]?.id;
      const setType = "Practice";
      const setNumber = index + 1;

      return {
        id: `practice-g${grade}-${category.toLowerCase().replace(/\s+/g, "-")}-${questionCount}-${setNumber}`,
        sourceQuizId,
        title: `${category} Grade ${grade} ${setType} ${setNumber}`,
        description: `${questionCount} grade-level questions for Grade ${grade} ${category}`,
        questions: selectedQuestions,
        subject: subjectQuizzes[0]?.subject || category,
        grade,
        difficulty: quizDifficulty,
        timeLimit: questionCount * 30,
        createdBy: sourceQuizId,
        createdAt: new Date(),
        topics: ["General"],
        category,
        gradeLevel: grade
      };
    };

    const practiceSets: QuizType[] = [];
    const categoriesToBuild = selectedCategory ? [selectedCategory] : categories;

    categoriesToBuild.forEach((category) => {
      const subjectQuizzes = quizzesByCategory.get(category) || [];
      for (let i = 0; i < 10; i++) {
        const questionCount = 10;
        practiceSets.push(buildSet(subjectQuizzes, category, questionCount, i));
      }
    });

    return practiceSets;
  }, [categories, quizzes, selectedCategory, selectedGradeNumber]);
  
  const filteredQuizzes = generatedPracticeQuizzes;

  useEffect(() => {
    if (!user?.id) return;
    const storageKey = `completed-practice-quizzes:${user.id}`;
    const storedIds = JSON.parse(localStorage.getItem(storageKey) || "[]") as string[];

    const loadCompletedFromDatabase = async () => {
      const { data } = await supabase
        .from("quiz_results")
        .select("quiz_id")
        .eq("student_id", user.id);
      const { data: attemptsData } = await supabase
        .from("question_attempts")
        .select("question_id")
        .eq("user_id", user.id);
      const dbIds = (data || []).map((entry) => entry.quiz_id).filter(Boolean);
      setCompletedQuizIds(new Set([...storedIds, ...dbIds]));
      setAttemptedQuestionIds(new Set((attemptsData || []).map((entry) => entry.question_id)));
    };

    loadCompletedFromDatabase();
  }, [user?.id]);

  const handleStartQuiz = (quiz: QuizType) => {
    const isCompletedQuiz = completedQuizIds.has(quiz.id) || (quiz.sourceQuizId && completedQuizIds.has(quiz.sourceQuizId));
    if (isCompletedQuiz) {
      toast.info("You already completed this quiz set before. You can retake it for more practice.");
    }

    const seenQuestionIds = new Set([...attemptedQuestionIds, ...askedQuestions]);
    const freshQuestions = quiz.questions.filter(q => !seenQuestionIds.has(q.id));
    const repeatedQuestions = quiz.questions.filter(q => seenQuestionIds.has(q.id));
    const nextQuestions = freshQuestions.length > 0 ? freshQuestions : repeatedQuestions;

    if (nextQuestions.length === 0) {
      toast.error("No questions available for this quiz yet.");
      return;
    }

    const modifiedQuiz = {
      ...quiz,
      questions: nextQuestions,
    };
    setAllowXPForActiveQuiz(!isCompletedQuiz && repeatedQuestions.length === 0);
    setActiveQuiz(modifiedQuiz);
  };
  
  const handleCreateRandomQuiz = () => {
    if (!selectedCategory) {
      toast.error("Please select a subject first");
      return;
    }

    const difficultyMap: Record<typeof difficulty, QuizType["difficulty"]> = {
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
    };
    const targetDifficulty = difficultyMap[difficulty];

    const matchingQuestions = quizzes
      .filter((quiz) => {
        const sameGrade = quiz.gradeLevel === selectedGradeNumber;
        const sameSubject = normalizeCategory(quiz.category) === normalizeCategory(selectedCategory);
        const difficultyMatch = quiz.difficulty === targetDifficulty;
        return sameGrade && sameSubject && difficultyMatch;
      })
      .flatMap((quiz) => quiz.questions);

    const freshPool = matchingQuestions.filter((question) => !attemptedQuestionIds.has(question.id));
    const shuffledFreshPool = [...freshPool].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffledFreshPool
      .slice(0, numQuestions)
      .map((question, index) => rotateOptionsForBalance(question, selectedGradeNumber, index));

    if (selectedQuestions.length < numQuestions) {
      toast.error(`Not enough new ${selectedCategory} questions available for Grade ${selectedGradeNumber} at ${targetDifficulty} level.`);
      return;
    }

    const randomQuiz: QuizType = {
      id: `quick-${selectedCategory.toLowerCase().replace(/\s+/g, "-")}-g${selectedGradeNumber}-${Date.now()}`,
      title: `Quick ${selectedCategory} Quiz - Grade ${selectedGradeNumber}`,
      description: `${numQuestions} random ${targetDifficulty.toLowerCase()} questions from your selected class level`,
      questions: selectedQuestions,
      subject: selectedCategory,
      grade: selectedGradeNumber,
      difficulty: targetDifficulty,
      timeLimit: numQuestions * 30,
      createdAt: new Date(),
      topics: ["General"],
      category: selectedCategory,
      gradeLevel: selectedGradeNumber
    };

    setAllowXPForActiveQuiz(true);
    setActiveQuiz(randomQuiz);
    toast.success(`Created a ${difficulty} ${selectedCategory} quiz with ${selectedQuestions.length} new questions`);
  };
  
  const handleQuizComplete = (score: number, completedQuestionIds: string[]) => {
    const newAskedQuestions = new Set(askedQuestions);
    completedQuestionIds.forEach(id => newAskedQuestions.add(id));
    setAskedQuestions(newAskedQuestions);
    setAttemptedQuestionIds(prev => {
      const next = new Set(prev);
      completedQuestionIds.forEach(id => next.add(id));
      return next;
    });
    if (activeQuiz && user?.id) {
      const nextCompleted = new Set(completedQuizIds);
      nextCompleted.add(activeQuiz.id);
      if (activeQuiz.sourceQuizId) nextCompleted.add(activeQuiz.sourceQuizId);
      setCompletedQuizIds(nextCompleted);
      localStorage.setItem(`completed-practice-quizzes:${user.id}`, JSON.stringify(Array.from(nextCompleted)));
    }
  };
  
  const handleExitQuiz = () => {
    setActiveQuiz(null);
  };

  const getCategoryIcon = (category: string) => {
    switch(category.toLowerCase()) {
      case "math":
        return <Calculator className="h-5 w-5" />;
      case "science":
        return <Atom className="h-5 w-5" />;
      case "english":
        return <BookOpen className="h-5 w-5" />;
      case "general knowledge":
        return <Brain className="h-5 w-5" />;
      default:
        return <Book className="h-5 w-5" />;
    }
  };

  const getXPPerCorrectAnswer = (difficulty: "Easy" | "Medium" | "Hard") => {
    switch (difficulty) {
      case "Easy":
        return 3;
      case "Hard":
        return 10;
      case "Medium":
      default:
        return 7;
    }
  };
  
  if (activeQuiz) {
    return (
      <QuizView 
        quiz={activeQuiz} 
        onComplete={handleQuizComplete} 
        onExit={handleExitQuiz} 
        allowXP={allowXPForActiveQuiz}
      />
    );
  }
  
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="minimal" showIcons={false} />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="glass border-b border-border/50 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <BackButton to="/" />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-display font-bold text-foreground">Quiz Center</h1>
                  <p className="text-xs text-muted-foreground">Choose your challenge</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  <Zap className="h-3 w-3 mr-1" />
                  {filteredQuizzes.length} Quizzes
                </Badge>
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto py-6 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-full grid-cols-2 glass border-border/30">
                <TabsTrigger value="browse" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Book className="h-4 w-4" />
                  Browse Quizzes
                </TabsTrigger>
                <TabsTrigger value="random" className="flex items-center gap-2 data-[state=active]:bg-accent data-[state=active]:text-white">
                  <Zap className="h-4 w-4" />
                  Quick Quiz
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="browse" className="mt-6">
                {/* Filters */}
                <Card className="glass border-border/30 mb-6">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Subject Filter */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={selectedCategory === null ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedCategory(null)}
                          className={selectedCategory === null ? "bg-primary" : "glass border-border/50"}
                        >
                          All Subjects
                        </Button>
                        {categories.map((category) => (
                          <Button
                            key={category}
                            variant={selectedCategory === category ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedCategory(category)}
                            className={`flex items-center gap-1 ${selectedCategory === category ? "bg-primary" : "glass border-border/50"}`}
                          >
                            {getCategoryIcon(category)}
                            {category}
                          </Button>
                        ))}
                      </div>
                      
                      {/* Grade Filter */}
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm font-medium text-muted-foreground">Grade:</span>
                        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                          <SelectTrigger className="w-28 glass border-border/50">
                            <SelectValue placeholder="Grade" />
                          </SelectTrigger>
                          <SelectContent>
                            {[5, 6, 7, 8, 9].map((grade) => (
                              <SelectItem key={grade} value={grade.toString()}>
                                Grade {grade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Quiz Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredQuizzes.map((quiz, index) => (
                    <motion.div
                      key={quiz.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="glass border-border/30 card-hover overflow-hidden">
                        <div className={`h-2 bg-gradient-to-r ${
                          quiz.category === 'Math' ? 'from-primary to-accent' :
                          quiz.category === 'Science' ? 'from-secondary to-glow-cyan' :
                          quiz.category === 'English' ? 'from-accent to-glow-pink' :
                          'from-glow-yellow to-orange-500'
                        }`} />
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                quiz.category === 'Math' ? 'bg-primary/20 text-primary' :
                                quiz.category === 'Science' ? 'bg-secondary/20 text-secondary' :
                                quiz.category === 'English' ? 'bg-accent/20 text-accent' :
                                'bg-glow-yellow/20 text-glow-yellow'
                              }`}>
                                {getCategoryIcon(quiz.category)}
                              </div>
                              <div>
                                <CardTitle className="text-base font-display">{quiz.title}</CardTitle>
                                <p className="text-xs text-muted-foreground">Grade {quiz.gradeLevel}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-xs ${
                              quiz.difficulty === 'Easy' ? 'border-glow-green text-glow-green' :
                              quiz.difficulty === 'Medium' ? 'border-glow-yellow text-glow-yellow' :
                              'border-destructive text-destructive'
                            }`}>
                              {quiz.difficulty}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                            <span className="flex items-center gap-1">
                              <Target className="h-4 w-4" />
                              {quiz.questions.length} Questions
                            </span>
                            <span className="flex items-center gap-1">
                              <Trophy className="h-4 w-4" />
                              +{quiz.questions.length * getXPPerCorrectAnswer(quiz.difficulty)} XP max
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            Done before: {quiz.questions.filter((q) => attemptedQuestionIds.has(q.id)).length}/{quiz.questions.length}
                          </p>
                          {(completedQuizIds.has(quiz.id) || (quiz.sourceQuizId && completedQuizIds.has(quiz.sourceQuizId))) && (
                            <Badge className="mb-3 bg-glow-green/20 text-glow-green border-glow-green/30">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Completed
                            </Badge>
                          )}
                          <Button
                            onClick={() => handleStartQuiz(quiz)}
                            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            {completedQuizIds.has(quiz.id) || (quiz.sourceQuizId && completedQuizIds.has(quiz.sourceQuizId)) ? "Retake Quiz" : "Start Quiz"}
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                  
                  {filteredQuizzes.length === 0 && (
                    <div className="col-span-full">
                      <Card className="glass border-border/30">
                        <CardContent className="py-12 text-center">
                          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No quizzes available for this grade/subject yet.</p>
                          <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => {
                              setSelectedCategory(null);
                              setSelectedGrade(studentGrade.toString());
                            }}
                          >
                            Reset Filters
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="random" className="mt-6">
                <Card className="glass border-border/30 mb-6">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Zap className="h-5 w-5 text-accent" />
                      Quick Quiz Generator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-sm text-muted-foreground">
                      Generate a random quiz based on your preferences. Perfect for quick practice!
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Subject</label>
                        <Select 
                          value={selectedCategory || ""} 
                          onValueChange={val => setSelectedCategory(val || null)}
                        >
                          <SelectTrigger className="glass border-border/50">
                            <SelectValue placeholder="Select Subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Grade</label>
                        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                          <SelectTrigger className="glass border-border/50">
                            <SelectValue placeholder="Select Grade" />
                          </SelectTrigger>
                          <SelectContent>
                            {[5, 6, 7, 8, 9].map((grade) => (
                              <SelectItem key={grade} value={grade.toString()}>
                                Grade {grade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Difficulty</label>
                        <Select 
                          value={difficulty} 
                          onValueChange={(val) => setDifficulty(val as "easy" | "medium" | "hard")}
                        >
                          <SelectTrigger className="glass border-border/50">
                            <SelectValue placeholder="Difficulty" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Questions</label>
                        <Select 
                          value={numQuestions.toString()} 
                          onValueChange={(val) => setNumQuestions(parseInt(val))}
                        >
                          <SelectTrigger className="glass border-border/50">
                            <SelectValue placeholder="Questions" />
                          </SelectTrigger>
                          <SelectContent>
                            {[5, 10, 15, 20].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num} Questions
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleCreateRandomQuiz} 
                      className="w-full bg-gradient-to-r from-accent to-glow-pink hover:opacity-90 h-12 text-lg"
                      disabled={!selectedCategory}
                    >
                      <Zap className="h-5 w-5 mr-2" />
                      Generate & Start Quiz
                    </Button>
                  </CardContent>
                </Card>
                
                {/* Daily Challenge Preview */}
                <Card className="glass border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-glow-yellow" />
                      Daily Challenges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { subject: "Mathematics", reward: "+50 XP", icon: Calculator, color: "from-primary to-accent" },
                        { subject: "Science", reward: "+50 XP", icon: Atom, color: "from-secondary to-glow-cyan" },
                        { subject: "English", reward: "+50 XP", icon: BookOpen, color: "from-accent to-glow-pink" }
                      ].map((challenge, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="p-4 rounded-xl bg-muted/30 border border-border/30"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${challenge.color} flex items-center justify-center`}>
                              <challenge.icon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{challenge.subject} Challenge</p>
                              <p className="text-xs text-muted-foreground">10 Questions</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge className="bg-glow-yellow/20 text-glow-yellow border-glow-yellow/30">
                              {challenge.reward}
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedCategory(challenge.subject);
                                setNumQuestions(10);
                                handleCreateRandomQuiz();
                              }}
                            >
                              Play
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </main>
        
        {/* Footer */}
        <footer className="text-center py-4 text-xs text-muted-foreground">
          Created by Biniam Bogale
        </footer>
      </div>
      
      <AIHelper />
    </div>
  );
};

export default Quiz;
