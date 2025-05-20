
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Question } from "@/context/QuizContext";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

interface QuestionCardProps {
  question: Question;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  timeLeft: number;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, onAnswer, timeLeft }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState<boolean>(false);
  
  const handleOptionSelect = (option: string) => {
    if (answered) return;
    setSelectedOption(option);
  };
  
  const handleSubmitAnswer = () => {
    if (!selectedOption || answered) return;
    
    const isCorrect = selectedOption === question.correctAnswer;
    setAnswered(true);
    onAnswer(selectedOption, isCorrect);
    
    if (isCorrect) {
      toast.success("Correct answer!");
    } else {
      toast.error("Incorrect answer!");
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div className="mb-6">
        <h3 className="text-xl font-medium mb-2">{question.text}</h3>
        <div className={`text-sm ${timeLeft <= 5 ? "text-red-500 font-semibold" : "text-gray-500"}`}>
          Time remaining: {timeLeft} seconds
        </div>
      </div>
      
      <div className="space-y-3 mb-6">
        {question.options.map((option) => (
          <div
            key={option}
            onClick={() => handleOptionSelect(option)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              answered && option === question.correctAnswer
                ? "border-green-500 bg-green-50"
                : answered && option === selectedOption && option !== question.correctAnswer
                ? "border-red-500 bg-red-50"
                : selectedOption === option
                ? "border-primary bg-primary/10"
                : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"
            }`}
          >
            <div className="flex justify-between items-center">
              <span>{option}</span>
              {answered && option === question.correctAnswer && (
                <Check className="text-green-500 h-5 w-5" />
              )}
              {answered && option === selectedOption && option !== question.correctAnswer && (
                <X className="text-red-500 h-5 w-5" />
              )}
            </div>
          </div>
        ))}
      </div>
      
      {!answered && (
        <Button 
          onClick={handleSubmitAnswer}
          disabled={!selectedOption}
          className="w-full"
        >
          Submit Answer
        </Button>
      )}
      
      {answered && question.explanation && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-100">
          <p className="font-medium mb-1">Explanation:</p>
          <p className="text-sm">{question.explanation}</p>
        </div>
      )}
    </motion.div>
  );
};

export default QuestionCard;
