
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Quiz } from "@/context/QuizContext";
import { motion } from "framer-motion";

interface QuizCardProps {
  quiz: Quiz;
  onStart: (quiz: Quiz) => void;
}

const QuizCard: React.FC<QuizCardProps> = ({ quiz, onStart }) => {
  // Get an emoji for the quiz category
  const getCategoryEmoji = (category: string): string => {
    switch (category.toLowerCase()) {
      case "math":
      case "mathematics":
        return "🧮";
      case "science":
        return "🔬";
      case "english":
        return "📝";
      case "general knowledge":
        return "🧠";
      default:
        return "📚";
    }
  };

  // Get background color based on category
  const getCategoryColor = (category: string): string => {
    switch (category.toLowerCase()) {
      case "math":
      case "mathematics":
        return "from-blue-500 to-indigo-600";
      case "science":
        return "from-green-500 to-teal-600";
      case "english":
        return "from-yellow-500 to-orange-600";
      case "general knowledge":
        return "from-purple-500 to-pink-600";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className="overflow-hidden">
        <div className={`h-24 bg-gradient-to-r ${getCategoryColor(quiz.category)} flex items-center justify-center`}>
          <span className="text-4xl">{getCategoryEmoji(quiz.category)}</span>
        </div>
        <CardHeader className="pb-2">
          <CardTitle>{quiz.title}</CardTitle>
          <CardDescription>
            Grade {quiz.gradeLevel} • {quiz.questions.length} Questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Difficulty: {getDifficultyLabel(quiz)}
            </div>
            <Button 
              onClick={() => onStart(quiz)} 
              className="bg-primary hover:bg-primary-dark"
            >
              Start Quiz
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Helper function to determine overall quiz difficulty
const getDifficultyLabel = (quiz: Quiz): string => {
  const difficulties = quiz.questions.map(q => q.difficulty);
  const difficultyCount = {
    Easy: difficulties.filter(d => d === "Easy").length,
    Medium: difficulties.filter(d => d === "Medium").length,
    Hard: difficulties.filter(d => d === "Hard").length,
  };
  
  if (difficultyCount.Hard > difficultyCount.Medium && difficultyCount.Hard > difficultyCount.Easy) {
    return "Hard";
  } else if (difficultyCount.Medium > difficultyCount.Easy) {
    return "Medium";
  }
  return "Easy";
};

export default QuizCard;
