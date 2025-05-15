
import React, { createContext, useContext, useState, ReactNode } from "react";

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  gradeLevel: number;
}

export interface Quiz {
  id: string;
  title: string;
  category: string;
  questions: Question[];
  gradeLevel: number;
}

interface QuizContextType {
  quizzes: Quiz[];
  activeQuiz: Quiz | null;
  setActiveQuiz: (quiz: Quiz | null) => void;
  getQuizzesByCategory: (category: string) => Quiz[];
  getQuizzesByGrade: (grade: number) => Quiz[];
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

// Sample quiz data
const sampleQuizzes: Quiz[] = [
  {
    id: "math-quiz-1",
    title: "Basic Mathematics",
    category: "Math",
    gradeLevel: 5,
    questions: [
      {
        id: "math-q1",
        text: "What is 5 + 7?",
        options: ["10", "12", "15", "11"],
        correctAnswer: "12",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 5,
      },
      {
        id: "math-q2",
        text: "What is 8 × 4?",
        options: ["24", "32", "36", "28"],
        correctAnswer: "32",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 5,
      },
      {
        id: "math-q3",
        text: "What is 20 ÷ 5?",
        options: ["4", "5", "6", "3"],
        correctAnswer: "4",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 5,
      },
    ],
  },
  {
    id: "science-quiz-1",
    title: "Basic Science",
    category: "Science",
    gradeLevel: 5,
    questions: [
      {
        id: "science-q1",
        text: "What is the closest planet to the Sun?",
        options: ["Venus", "Earth", "Mercury", "Mars"],
        correctAnswer: "Mercury",
        category: "Science",
        difficulty: "easy",
        gradeLevel: 5,
      },
      {
        id: "science-q2",
        text: "What is the chemical symbol for water?",
        options: ["WA", "H2O", "W", "O2H"],
        correctAnswer: "H2O",
        category: "Science",
        difficulty: "easy",
        gradeLevel: 5,
      },
      {
        id: "science-q3",
        text: "Which gas do plants absorb from the atmosphere?",
        options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
        correctAnswer: "Carbon Dioxide",
        category: "Science",
        difficulty: "easy",
        gradeLevel: 5,
      },
    ],
  },
  {
    id: "english-quiz-1",
    title: "Basic English",
    category: "English",
    gradeLevel: 5,
    questions: [
      {
        id: "english-q1",
        text: "What is the past tense of 'run'?",
        options: ["Runned", "Ran", "Running", "Runs"],
        correctAnswer: "Ran",
        category: "English",
        difficulty: "easy",
        gradeLevel: 5,
      },
      {
        id: "english-q2",
        text: "Which of these is a noun?",
        options: ["Jump", "Fast", "House", "Beautiful"],
        correctAnswer: "House",
        category: "English",
        difficulty: "easy",
        gradeLevel: 5,
      },
      {
        id: "english-q3",
        text: "What is the opposite of 'big'?",
        options: ["Large", "Small", "Huge", "Tiny"],
        correctAnswer: "Small",
        category: "English",
        difficulty: "easy",
        gradeLevel: 5,
      },
    ],
  },
];

export const QuizProvider = ({ children }: { children: ReactNode }) => {
  const [quizzes] = useState<Quiz[]>(sampleQuizzes);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  const getQuizzesByCategory = (category: string): Quiz[] => {
    return quizzes.filter(quiz => quiz.category.toLowerCase() === category.toLowerCase());
  };

  const getQuizzesByGrade = (grade: number): Quiz[] => {
    return quizzes.filter(quiz => quiz.gradeLevel === grade);
  };

  return (
    <QuizContext.Provider
      value={{
        quizzes,
        activeQuiz,
        setActiveQuiz,
        getQuizzesByCategory,
        getQuizzesByGrade,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
};

export const useQuiz = () => {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error("useQuiz must be used within a QuizProvider");
  }
  return context;
};
