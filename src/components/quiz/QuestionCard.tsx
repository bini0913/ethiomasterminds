
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Question } from "@/context/QuizContext";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface QuestionCardProps {
  question: Question;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  timeLeft: number;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, onAnswer, timeLeft }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState<boolean>(false);
  const normalizedOptions =
    question.type === "Multiple Choice"
      ? [...question.options, "", "", "", ""].slice(0, 4)
      : question.options;
  
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
      toast.error(`Incorrect! The correct answer was: ${question.correctAnswer}`);
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
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">
            {question.subject} • Grade {question.grade} • {question.topic}
          </span>
          <span className={`text-sm ${timeLeft <= 5 ? "text-red-500 font-semibold" : "text-gray-500"}`}>
            Time: {timeLeft}s
          </span>
        </div>
      </div>
      
      <div className="space-y-3 mb-6">
        {normalizedOptions.map((option, index) => {
          const optionLabel = String.fromCharCode(65 + index); // A, B, C, D
          return (
            <div
              key={`${optionLabel}-${index}`}
              onClick={() => handleOptionSelect(option)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                answered && option === question.correctAnswer
                  ? "border-green-500 bg-green-500/10 dark:bg-green-500/20"
                  : answered && option === selectedOption && option !== question.correctAnswer
                  ? "border-red-500 bg-red-500/10 dark:bg-red-500/20"
                  : selectedOption === option
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    answered && option === question.correctAnswer
                      ? "bg-green-500 text-white"
                      : answered && option === selectedOption && option !== question.correctAnswer
                      ? "bg-red-500 text-white"
                      : selectedOption === option
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {optionLabel}
                  </span>
                  <span className="text-foreground">{option}</span>
                </div>
                {answered && option === question.correctAnswer && (
                  <Check className="text-green-500 h-5 w-5" />
                )}
                {answered && option === selectedOption && option !== question.correctAnswer && (
                  <X className="text-red-500 h-5 w-5" />
                )}
              </div>
            </div>
          );
        })}
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
