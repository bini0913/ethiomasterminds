import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/context/UserContext";
import { Question, Quiz } from "@/context/QuizContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GainXPButton from "../profile/GainXPButton";
import QuestionCard from "./QuestionCard";
import VoiceAnswerInput from "./VoiceAnswerInput";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import MindForgeReactionOverlay from "./MindForgeReactionOverlay";
import { getMindForgeSettings, MindForgeReactionType } from "@/lib/mindforge";

interface QuizViewProps {
  quiz: Quiz;
  onComplete: (score: number, completedQuestionIds: string[]) => void;
  onExit: () => void;
  allowXP?: boolean;
}

const QuizView: React.FC<QuizViewProps> = ({ quiz, onComplete, onExit, allowXP = true }) => {
  const { addXP, user } = useUser();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{[key: string]: string}>({});
  const [completedQuestionIds, setCompletedQuestionIds] = useState<string[]>([]);
  const [answeredCorrectly, setAnsweredCorrectly] = useState(0);
  const [voiceMode, setVoiceMode] = useState(false);
  const [streak, setStreak] = useState(0);
  const [activeReaction, setActiveReaction] = useState<MindForgeReactionType | null>(null);
  const [reactionTip, setReactionTip] = useState<string | undefined>();
  const [wrongByTopic, setWrongByTopic] = useState<Record<string, number>>({});
  const reactionTimeoutRef = useRef<number | null>(null);
  const mindForgeSettings = getMindForgeSettings();
  const questionStartTime = useRef(Date.now());
  const questionTimes = useRef<{[key: string]: number}>({});
  const uuidLikeRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Get the current question from the quiz
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
    setIsAnswered(false);
    questionStartTime.current = Date.now();
  }, [currentQuestionIndex]);
  
  const handleTimeout = () => {
    if (!isAnswered) {
      setIsAnswered(true);
      // Record that the user didn't answer this question
      setUserAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: "no_answer"
      }));

      // Add to completed questions
      setCompletedQuestionIds(prev => [...prev, currentQuestion.id]);
      
      toast.error("Time's up!");
    }
  };
  
  const handleAnswerSubmit = (answer: string, isCorrect: boolean) => {
    setIsAnswered(true);
    
    // Track time spent on this question
    const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);
    questionTimes.current[currentQuestion.id] = timeTaken;
    
    // Record user's answer
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));
    
    // Add to completed questions
    setCompletedQuestionIds(prev => [...prev, currentQuestion.id]);
    
    if (isCorrect) {
      const pointsEarned = calculatePoints(timeLeft);
      setScore(score + pointsEarned);
      setAnsweredCorrectly(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);

      if (mindForgeSettings.reactionsEnabled) {
        const reactionType: MindForgeReactionType = newStreak >= 10
          ? "correct_power"
          : newStreak >= 3
          ? "correct_combo"
          : "correct_basic";
        triggerReaction(reactionType);
      }

      toast.success(`Correct! +${pointsEarned} points`);
    } else {
      setStreak(0);
      const nextWrongCount = (wrongByTopic[currentQuestion.topic] || 0) + 1;
      setWrongByTopic((prev) => ({ ...prev, [currentQuestion.topic]: nextWrongCount }));

      if (mindForgeSettings.reactionsEnabled) {
        const tip = currentQuestion.explanation || `Remember the key concept for ${currentQuestion.topic}.`;
        setReactionTip(tip);
        triggerReaction(nextWrongCount >= 3 ? "focus_boost" : "wrong_growth", 3200);
      }

      toast.error("Incorrect answer!");
    }
  };

  const triggerReaction = (reaction: MindForgeReactionType, duration = 2300) => {
    setActiveReaction(reaction);
    if (reactionTimeoutRef.current) {
      window.clearTimeout(reactionTimeoutRef.current);
    }
    reactionTimeoutRef.current = window.setTimeout(() => {
      setActiveReaction(null);
      setReactionTip(undefined);
    }, duration);
  };

  useEffect(() => {
    return () => {
      if (reactionTimeoutRef.current) {
        window.clearTimeout(reactionTimeoutRef.current);
      }
    };
  }, []);
  
  const calculatePoints = (timeRemaining: number) => {
    // Base points for correct answer
    const basePoints = currentQuestion.points || 10;
    // Bonus points based on remaining time (max 50% bonus)
    const timeBonus = Math.floor((timeRemaining / 20) * (basePoints * 0.5));
    return basePoints + timeBonus;
  };

  const getXPPerCorrectAnswer = () => {
    switch (quiz.difficulty) {
      case "Easy":
        return 3;
      case "Hard":
        return 10;
      case "Medium":
      default:
        return 7;
    }
  };
  
  const saveQuizResults = async (finalScore: number, totalXP: number) => {
    try {
      const totalTimeTaken = Object.values(questionTimes.current).reduce((a, b) => a + b, 0);
      const persistedQuizId = quiz.sourceQuizId || quiz.id;

      // Some student practice sets are generated from existing questions and use
      // client-side ids, so we only persist if we have a valid db quiz UUID.
      if (!uuidLikeRegex.test(persistedQuizId)) {
        return;
      }
      
      // Save quiz result
      await supabase.from('quiz_results').insert({
        quiz_id: persistedQuizId,
        student_id: user!.id,
        score: finalScore,
        total_questions: quiz.questions.length,
        correct_answers: answeredCorrectly,
        time_taken: totalTimeTaken,
        xp_earned: totalXP,
        answers: userAnswers as any
      });

      // Save individual question attempts
      const attempts = quiz.questions.map((q) => ({
        quiz_id: persistedQuizId,
        question_id: q.id,
        user_id: user!.id,
        selected_answer: userAnswers[q.id] || 'no_answer',
        is_correct: userAnswers[q.id] === q.correctAnswer,
        time_taken_seconds: questionTimes.current[q.id] || 20
      }));
      
      await supabase.from('question_attempts').insert(attempts);

      // Update analytics, streak, and achievements
      const avgTime = totalTimeTaken / quiz.questions.length;
      await Promise.all([
        supabase.rpc('update_analytics', {
          p_user_id: user!.id,
          p_subject: quiz.subject,
          p_correct: answeredCorrectly,
          p_total: quiz.questions.length,
          p_avg_time: avgTime
        }),
        supabase.rpc('update_user_streak', { p_user_id: user!.id }),
        supabase.rpc('check_achievements', { p_user_id: user!.id })
      ]);
    } catch (err) {
      console.error('Failed to save quiz results:', err);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Quiz completed
      const finalScore = score;
      setQuizCompleted(true);
      
      // Calculate XP by difficulty and number of correct answers.
      // Easy = 3 XP, Medium = 7 XP, Hard = 10 XP per correct answer.
      const xpPerCorrectAnswer = getXPPerCorrectAnswer();
      const totalXP = allowXP ? answeredCorrectly * xpPerCorrectAnswer : 0;
      
      setEarnedXP(totalXP);
      
      // Save results to database
      if (user?.id) {
        saveQuizResults(finalScore, totalXP);
      }
      
      // Call the onComplete callback with completed question IDs
      onComplete(finalScore, completedQuestionIds);
    }
  };
  
  const handleClaimXP = () => {
    if (!allowXP) {
      toast.info("Retake detected: points are not awarded for already-attempted questions.");
      return;
    }

    if (earnedXP > 0) {
      addXP(earnedXP);
      toast.success(`You've gained ${earnedXP} XP!`, {
        description: "Keep playing to level up faster!"
      });
      setEarnedXP(0);
    }
  };
  
  const handlePlayAgain = () => {
    setCurrentQuestionIndex(0);
    setIsAnswered(false);
    setScore(0);
    setUserAnswers({});
    setQuizCompleted(false);
    setCompletedQuestionIds([]);
    setAnsweredCorrectly(0);
  };
  
  // Calculate accuracy percentage
  const calculateAccuracy = () => {
    const totalAnswered = Object.keys(userAnswers).length;
    if (totalAnswered === 0) return 0;
    
    return Math.floor((answeredCorrectly / totalAnswered) * 100);
  };
  
  return (
    <div className="container relative max-w-xl mx-auto py-6">
      <MindForgeReactionOverlay
        activeReaction={activeReaction}
        streak={streak}
        reducedMotion={mindForgeSettings.reducedMotion}
        tip={reactionTip}
      />
      {!quizCompleted ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold">{quiz.title}</h2>
              <p className="text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="voice-mode" checked={voiceMode} onCheckedChange={setVoiceMode} />
              <Label htmlFor="voice-mode" className="flex items-center gap-1 text-sm cursor-pointer">
                <Mic className="h-4 w-4" /> Voice
              </Label>
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
                Question {currentQuestionIndex + 1}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <QuestionCard 
                    question={currentQuestion}
                    onAnswer={handleAnswerSubmit}
                    timeLeft={timeLeft}
                  />
                  
                  {/* Voice Answer Input */}
                  {voiceMode && !isAnswered && (
                    <div className="mt-4">
                      <VoiceAnswerInput
                        questionType={
                          currentQuestion.type === 'True/False' ? 'true_false' :
                          currentQuestion.type === 'Fill in the blank' ? 'fill_blank' : 'multiple_choice'
                        }
                        options={currentQuestion.options}
                        correctAnswer={currentQuestion.correctAnswer}
                        onAnswer={handleAnswerSubmit}
                        disabled={isAnswered}
                      />
                    </div>
                  )}
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
                  <div className="text-2xl font-bold text-primary">{calculateAccuracy()}%</div>
                  <div className="text-sm text-gray-500">Accuracy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-500">{answeredCorrectly}/{quiz.questions.length}</div>
                  <div className="text-sm text-gray-500">Correct Answers</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-500">+{earnedXP}</div>
                  <div className="text-sm text-gray-500">XP Earned</div>
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
              onClick={handlePlayAgain}
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
