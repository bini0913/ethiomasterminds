
import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { useQuiz, Question } from "@/context/QuizContext";
import { toast } from "sonner";

const DailyChallenge: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addXP } = useUser();
  
  // Get a random question for the daily challenge
  const { quizzes } = useQuiz();
  const allQuestions: Question[] = quizzes.flatMap(quiz => quiz.questions);
  
  // Use a fixed seed for the day to ensure all users get the same daily question
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const dailyQuestion = allQuestions[seed % allQuestions.length];
  
  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    
    setIsLoading(true);
    setSelectedOption(option);
    
    // Simulate loading/checking
    setTimeout(() => {
      setIsAnswered(true);
      setIsLoading(false);
      
      if (option === dailyQuestion.correctAnswer) {
        addXP(15); // Award XP for completing daily challenge
        toast.success("Correct! +15 XP awarded!");
      } else {
        toast.error("Incorrect answer. Try again tomorrow!");
      }
    }, 1000);
  };
  
  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <CardTitle className="flex items-center justify-between">
          <span>Daily Challenge</span>
          <div className="text-sm bg-white text-blue-600 px-2 py-1 rounded-full">
            +15 XP
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="font-medium mb-4">{dailyQuestion.text}</p>
        <div className="space-y-2">
          {dailyQuestion.options.map((option) => (
            <div
              key={option}
              onClick={() => handleOptionSelect(option)}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                isLoading && selectedOption === option
                  ? "border-blue-300 bg-blue-50 animate-pulse"
                  : isAnswered && option === dailyQuestion.correctAnswer
                  ? "border-green-500 bg-green-50"
                  : isAnswered && option === selectedOption
                  ? "border-red-500 bg-red-50"
                  : selectedOption === option
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              {option}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3">
        <div className="text-sm text-gray-500 w-full">
          {isAnswered ? (
            <div className="flex justify-between items-center">
              <span>
                {selectedOption === dailyQuestion.correctAnswer
                  ? "Great job! Come back tomorrow for another challenge."
                  : "The correct answer was: " + dailyQuestion.correctAnswer}
              </span>
            </div>
          ) : (
            <span>Complete this challenge to earn XP!</span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default DailyChallenge;
