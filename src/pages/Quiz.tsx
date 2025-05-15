
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuiz, Quiz as QuizType } from "@/context/QuizContext";
import QuizCard from "@/components/quiz/QuizCard";
import QuizView from "@/components/quiz/QuizView";

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const { quizzes } = useQuiz();
  const [activeQuiz, setActiveQuiz] = useState<QuizType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Filter unique categories from all quizzes
  const categories = [...new Set(quizzes.map(quiz => quiz.category))];
  
  // Filter quizzes by selected category
  const filteredQuizzes = selectedCategory 
    ? quizzes.filter(quiz => quiz.category === selectedCategory)
    : quizzes;
  
  const handleStartQuiz = (quiz: QuizType) => {
    setActiveQuiz(quiz);
  };
  
  const handleQuizComplete = (score: number) => {
    // This will be called when a quiz is completed
    console.log("Quiz completed with score:", score);
  };
  
  const handleExitQuiz = () => {
    setActiveQuiz(null);
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
      
      {/* Category Filter */}
      <div className="px-4 py-4">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className={selectedCategory === null ? "bg-primary" : ""}
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? "bg-primary" : ""}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Quiz List */}
      <div className="px-4 py-2 space-y-4">
        {filteredQuizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} onStart={handleStartQuiz} />
        ))}
        
        {filteredQuizzes.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No quizzes available for this category.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quiz;
