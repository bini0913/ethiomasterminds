import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuiz, Quiz as QuizType } from "@/context/QuizContext";
import QuizCard from "@/components/quiz/QuizCard";
import QuizView from "@/components/quiz/QuizView";
import { useUser } from "@/context/UserContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, Award, Calculator, Atom, BookOpen, Brain, Zap, Trophy, Target, Play } from "lucide-react";
import { toast } from "sonner";
import AIHelper from "@/components/ai/AIHelper";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import BackButton from "@/components/ui/BackButton";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const { quizzes, createRandomQuiz } = useQuiz();
  const { user } = useUser();
  const [activeQuiz, setActiveQuiz] = useState<QuizType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>(user?.grade || "5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [activeTab, setActiveTab] = useState<string>("browse");
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [askedQuestions, setAskedQuestions] = useState<Set<string>>(new Set());
  
  // Filter unique categories from all quizzes
  const categories = [...new Set(quizzes.map(quiz => quiz.category))];

  // Split quizzes into smaller chunks of 10 questions each
  const splitQuizzes = useMemo(() => {
    const result: QuizType[] = [];
    
    quizzes.forEach(quiz => {
      if (quiz.questions.length <= 10) {
        result.push(quiz);
      } else {
        // Split large quizzes into chunks of 10
        const chunks = Math.ceil(quiz.questions.length / 10);
        for (let i = 0; i < chunks; i++) {
          const startIdx = i * 10;
          const endIdx = Math.min((i + 1) * 10, quiz.questions.length);
          const chunkQuestions = quiz.questions.slice(startIdx, endIdx);
          
          result.push({
            ...quiz,
            id: `${quiz.id}-part${i + 1}`,
            title: `${quiz.title} (Part ${i + 1})`,
            description: `${quiz.description} - Questions ${startIdx + 1}-${endIdx}`,
            questions: chunkQuestions
          });
        }
      }
    });
    
    return result;
  }, [quizzes]);
  
  // Filter quizzes by selected filters
  const filteredQuizzes = splitQuizzes.filter(quiz => {
    const matchesCategory = !selectedCategory || quiz.category === selectedCategory;
    const matchesGrade = quiz.gradeLevel.toString() === selectedGrade;
    return matchesCategory && matchesGrade;
  });

  const handleStartQuiz = (quiz: QuizType) => {
    const uniqueQuestions = quiz.questions.filter(q => !askedQuestions.has(q.id));
    
    if (uniqueQuestions.length === 0) {
      toast.warning("You've already completed all questions in this quiz. We'll reset and give you some new challenges!");
      setAskedQuestions(new Set());
      setActiveQuiz(quiz);
    } else {
      const modifiedQuiz = {
        ...quiz,
        questions: uniqueQuestions.length > 0 ? uniqueQuestions : quiz.questions,
      };
      setActiveQuiz(modifiedQuiz);
    }
  };
  
  const handleCreateRandomQuiz = () => {
    if (!selectedCategory) {
      toast.error("Please select a subject first");
      return;
    }
    
    const randomQuiz = createRandomQuiz(
      selectedCategory, 
      numQuestions,
      parseInt(selectedGrade),
      difficulty
    );
    
    if (randomQuiz) {
      const uniqueQuestions = randomQuiz.questions.filter(q => !askedQuestions.has(q.id));
      
      if (uniqueQuestions.length < numQuestions / 2) {
        toast.warning("You've seen most questions at this level! We'll add some new ones to keep it interesting.");
      }
      
      const finalQuiz = {
        ...randomQuiz,
        questions: uniqueQuestions.length > numQuestions / 2 ? uniqueQuestions : randomQuiz.questions,
      };
      
      setActiveQuiz(finalQuiz);
      toast.success(`Created a ${difficulty} ${selectedCategory} quiz with ${finalQuiz.questions.length} questions`);
    } else {
      toast.error("Could not create quiz. Not enough questions available for selected criteria.");
    }
  };
  
  const handleQuizComplete = (score: number, completedQuestionIds: string[]) => {
    const newAskedQuestions = new Set(askedQuestions);
    completedQuestionIds.forEach(id => newAskedQuestions.add(id));
    setAskedQuestions(newAskedQuestions);
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
  
  if (activeQuiz) {
    return (
      <QuizView 
        quiz={activeQuiz} 
        onComplete={handleQuizComplete} 
        onExit={handleExitQuiz} 
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
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
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
                              +{quiz.questions.length * 10} XP
                            </span>
                          </div>
                          <Button
                            onClick={() => handleStartQuiz(quiz)}
                            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Start Quiz
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
                          <p className="text-muted-foreground">No quizzes available with the selected filters.</p>
                          <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => {
                              setSelectedCategory(null);
                              setSelectedGrade("5");
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
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
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
                        { subject: "Math", reward: "+50 XP", icon: Calculator, color: "from-primary to-accent" },
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
