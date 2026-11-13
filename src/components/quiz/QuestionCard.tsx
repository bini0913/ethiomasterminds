
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
        <h3 className="mb-3 font-display text-2xl font-bold leading-snug">{question.text}</h3>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">
            {question.subject} • Grade {question.grade} • {question.topic}
          </span>
          <span className={`text-sm ${timeLeft <= 5 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
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
              role="button"
              tabIndex={0}
              aria-pressed={selectedOption === option}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOptionSelect(option); } }}
              className={`min-h-14 cursor-pointer rounded-2xl border-2 border-b-4 p-4 transition-all active:translate-y-[2px] active:border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                answered && option === question.correctAnswer
                  ? "border-success bg-success/10"
                  : answered && option === selectedOption
                  ? "border-destructive bg-destructive/10"
                  : selectedOption === option
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted/60"
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    answered && option === question.correctAnswer
                      ? "bg-success text-success-foreground"
                      : answered && option === selectedOption && option !== question.correctAnswer
                      ? "bg-destructive text-destructive-foreground"
                      : selectedOption === option
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {optionLabel}
                  </span>
                  <span className="text-foreground">{option}</span>
                </div>
                {answered && option === question.correctAnswer && (
                  <Check className="text-success h-5 w-5" />
                )}
                {answered && option === selectedOption && option !== question.correctAnswer && (
                  <X className="text-destructive h-5 w-5" />
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
          className="mm-btn h-14 w-full text-base font-bold uppercase tracking-wide"
        >
          Check
        </Button>
      )}
      
      {answered && question.explanation && (
        <div className={`mt-4 rounded-2xl border-2 p-4 animate-in slide-in-from-bottom-4 ${selectedOption === question.correctAnswer ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}>
          <p className="font-medium mb-1">Explanation:</p>
          <p className="text-sm">{question.explanation}</p>
        </div>
      )}
    </motion.div>
  );
};

export default QuestionCard;
