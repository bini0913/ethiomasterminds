
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuiz, Quiz as QuizType } from "@/context/QuizContext";
import QuizCard from "@/components/quiz/QuizCard";
import QuizView from "@/components/quiz/QuizView";
import { useUser } from "@/context/UserContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, Award, Calculator, Atom, BookOpen, Brain } from "lucide-react";
import { toast } from "sonner";

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const { quizzes, createRandomQuiz } = useQuiz();
  const { user } = useUser();
  const [activeQuiz, setActiveQuiz] = useState<QuizType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>(user?.grade || "5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [activeTab, setActiveTab] = useState<string>("browse");
  const [numQuestions, setNumQuestions] = useState<number>(5);
  
  // Filter unique categories from all quizzes
  const categories = [...new Set(quizzes.map(quiz => quiz.category))];
  
  // Filter quizzes by selected filters
  const filteredQuizzes = quizzes.filter(quiz => {
    const matchesCategory = !selectedCategory || quiz.category === selectedCategory;
    const matchesGrade = quiz.gradeLevel.toString() === selectedGrade;
    return matchesCategory && matchesGrade;
  });

  const handleStartQuiz = (quiz: QuizType) => {
    setActiveQuiz(quiz);
  };
  
  const handleCreateRandomQuiz = () => {
    if (!selectedCategory) {
      toast.error("Please select a subject first");
      return;
    }
    
    const randomQuiz = createRandomQuiz(
      selectedCategory, 
      numQuestions, // Number of questions
      parseInt(selectedGrade),
      difficulty
    );
    
    if (randomQuiz) {
      setActiveQuiz(randomQuiz);
      toast.success(`Created a ${difficulty} ${selectedCategory} quiz with ${numQuestions} questions`);
    } else {
      toast.error("Could not create quiz. Not enough questions available for selected criteria.");
    }
  };
  
  const handleQuizComplete = (score: number) => {
    // This will be called when a quiz is completed
    console.log("Quiz completed with score:", score);
  };
  
  const handleExitQuiz = () => {
    setActiveQuiz(null);
  };

  // Get category icon
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary px-4 py-3 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Quizzes</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
          >
            Back to Menu
          </Button>
        </div>
      </header>
      
      <div className="container mx-auto py-6 px-4">
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse" className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Browse Quizzes
            </TabsTrigger>
            <TabsTrigger value="random" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Quick Quiz
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="browse">
            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-3 mb-4 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className={selectedCategory === null ? "bg-primary" : ""}
              >
                All Subjects
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-1 ${selectedCategory === category ? "bg-primary" : ""}`}
                >
                  {getCategoryIcon(category)}
                  {category}
                </Button>
              ))}
            </div>
            
            {/* Grade Filter */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-medium">Grade:</span>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select Grade" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((grade) => (
                    <SelectItem key={grade} value={grade.toString()}>
                      Grade {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Quiz List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQuizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} onStart={handleStartQuiz} />
              ))}
              
              {filteredQuizzes.length === 0 && (
                <div className="col-span-full text-center py-8">
                  <p className="text-gray-500">No quizzes available with the selected filters.</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="random">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Quick Quiz</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">
                  Create a random quiz based on your preferences. Great for quick practice or daily challenges!
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Category Selection */}
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Subject</span>
                    <Select 
                      value={selectedCategory || ""} 
                      onValueChange={val => setSelectedCategory(val || null)}
                    >
                      <SelectTrigger>
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
                  
                  {/* Grade Selection */}
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Grade</span>
                    <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((grade) => (
                          <SelectItem key={grade} value={grade.toString()}>
                            Grade {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Difficulty Selection */}
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Difficulty</span>
                    <Select 
                      value={difficulty} 
                      onValueChange={(val) => setDifficulty(val as "easy" | "medium" | "hard")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Number of Questions Selection */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Number of Questions</span>
                  <Select 
                    value={numQuestions.toString()} 
                    onValueChange={(val) => setNumQuestions(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Number of Questions" />
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
                
                <Button 
                  onClick={handleCreateRandomQuiz} 
                  className="w-full"
                  disabled={!selectedCategory}
                >
                  Start Quick Quiz
                </Button>
              </CardContent>
            </Card>
            
            {/* Daily Challenges - Placeholder for future implementation */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Challenges</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Complete daily challenges to earn extra XP and special rewards!
                </p>
                <div className="text-center p-6 border border-dashed rounded-lg">
                  <p className="text-gray-400">Daily challenges coming soon!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Quiz;
