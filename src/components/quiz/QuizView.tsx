import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { Question, Quiz } from "@/context/QuizContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GainXPButton from "../profile/GainXPButton";

interface QuizViewProps {
  quiz: Quiz;
  onComplete: (score: number) => void;
  onExit: () => void;
}

const QuizView: React.FC<QuizViewProps> = ({ quiz, onComplete, onExit }) => {
  const { addXP, user } = useUser();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);

  const currentQuestion = quiz.questions[currentQuestionIndex];
  
  // Timer effect
  useEffect(() => {
    if (isAnswered || quizCompleted) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [currentQuestionIndex, isAnswered, quizCompleted]);
  
  // Reset timer when moving to next question
  useEffect(() => {
    setTimeLeft(20);
  }, [currentQuestionIndex]);
  
  const handleTimeout = () => {
    if (!isAnswered) {
      setIsAnswered(true);
      toast.error("Time's up!");
    }
  };
  
  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    
    setSelectedOption(option);
    setIsAnswered(true);
    
    if (option === currentQuestion.correctAnswer) {
      const pointsEarned = calculatePoints(timeLeft);
      setScore(score + pointsEarned);
      toast.success(`Correct! +${pointsEarned} points`);
    } else {
      toast.error("Incorrect answer!");
    }
  };
  
  const calculatePoints = (timeRemaining: number) => {
    // Base points for correct answer
    const basePoints = 10;
    // Bonus points based on remaining time (max 10 bonus points)
    const timeBonus = Math.floor((timeRemaining / 20) * 10);
    return basePoints + timeBonus;
  };
  
  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Quiz completed
      const finalScore = score;
      setQuizCompleted(true);
      
      // Calculate XP to award based on score
      const xpToEarn = Math.floor(finalScore / 2);
      setEarnedXP(xpToEarn);
      
      // Call the onComplete callback
      onComplete(finalScore);
    }
  };
  
  const handleClaimXP = () => {
    if (earnedXP > 0) {
      addXP(earnedXP);
      toast.success(`You've claimed ${earnedXP} XP!`, {
        description: "Keep playing to level up faster!"
      });
      setEarnedXP(0);
    }
  };
  
  return (
    <div className="container max-w-xl mx-auto py-6">
      {!quizCompleted ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold">{quiz.title}</h2>
              <p className="text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">{score} pts</div>
              <div className={`text-sm ${timeLeft <= 5 ? "text-red-500 font-semibold" : "text-gray-500"}`}>
                Time: {timeLeft}s
              </div>
            </div>
          </div>
          
          {/* Question Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg leading-tight">
                {currentQuestion.text}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  {currentQuestion.options.map((option) => (
                    <div
                      key={option}
                      onClick={() => handleOptionSelect(option)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isAnswered && option === currentQuestion.correctAnswer
                          ? "border-green-500 bg-green-50"
                          : isAnswered && option === selectedOption
                          ? "border-red-500 bg-red-50"
                          : selectedOption === option
                          ? "border-primary bg-primary-light"
                          : "border-gray-200 hover:border-primary-light"
                      }`}
                    >
                      {option}
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </CardContent>
            <CardFooter className="justify-between border-t pt-4">
              <Button variant="outline" onClick={onExit}>
                Exit Quiz
              </Button>
              {isAnswered && (
                <Button 
                  onClick={handleNextQuestion}
                  className="bg-primary hover:bg-primary-dark"
                >
                  {currentQuestionIndex < quiz.questions.length - 1 ? "Next Question" : "See Results"}
                </Button>
              )}
            </CardFooter>
          </Card>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-primary h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
            ></div>
          </div>
        </>
      ) : (
        <Card className="text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Quiz Completed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="my-6">
              <div className="text-6xl mb-2">🏆</div>
              <div className="text-3xl font-bold">{score} points</div>
              <div className="text-sm text-gray-500">Great job!</div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-lg font-semibold mb-2">Your Results</div>
              <div className="flex justify-center space-x-8">
                <div>
                  <div className="text-2xl font-bold text-primary">{Math.floor(score / (quiz.questions.length * 20) * 100)}%</div>
                  <div className="text-sm text-gray-500">Accuracy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-500">+{earnedXP}</div>
                  <div className="text-sm text-gray-500">XP Available</div>
                </div>
              </div>
              
              {/* XP Claim Button */}
              {earnedXP > 0 && (
                <div className="mt-4">
                  <GainXPButton 
                    amount={earnedXP} 
                    variant="secondary" 
                    size="lg"
                    label={`Claim ${earnedXP} XP`}
                    className="mx-auto"
                    onClick={handleClaimXP}
                  />
                </div>
              )}

              {/* Rank Display */}
              {user && (
                <div className="mt-4 p-3 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg">
                  <div className="text-sm text-gray-600">Current Level</div>
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                    Level {user.level} 
                    <span className="text-xs px-2 py-0.5 bg-primary text-white rounded-full">
                      {user.level < 3 ? "Rookie" : 
                       user.level < 6 ? "Thinker" : 
                       user.level < 10 ? "Challenger" : 
                       user.level < 15 ? "Genius" : "Master Mind"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-center space-x-4">
            <Button variant="outline" onClick={onExit}>
              Return to Menu
            </Button>
            <Button 
              onClick={() => {
                setCurrentQuestionIndex(0);
                setSelectedOption(null);
                setIsAnswered(false);
                setScore(0);
                setQuizCompleted(false);
              }}
              className="bg-primary hover:bg-primary-dark"
            >
              Play Again
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default QuizView;
