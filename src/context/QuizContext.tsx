
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
  getQuizzesByDifficulty: (difficulty: "easy" | "medium" | "hard") => Quiz[];
  createRandomQuiz: (category: string, count: number, gradeLevel: number) => Quiz | null;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

// Expanded sample quiz data
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
      {
        id: "math-q4",
        text: "What is 15 - 9?",
        options: ["6", "7", "5", "4"],
        correctAnswer: "6",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 5,
      },
      {
        id: "math-q5",
        text: "Which of these is not a prime number?",
        options: ["2", "3", "4", "5"],
        correctAnswer: "4",
        category: "Math",
        difficulty: "medium",
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
      {
        id: "science-q4",
        text: "Which of these is not a state of matter?",
        options: ["Solid", "Liquid", "Gas", "Energy"],
        correctAnswer: "Energy",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 5,
      },
      {
        id: "science-q5",
        text: "What is the largest organ in the human body?",
        options: ["Heart", "Liver", "Skin", "Brain"],
        correctAnswer: "Skin",
        category: "Science",
        difficulty: "medium", 
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
      {
        id: "english-q4",
        text: "Which of these is an adverb?",
        options: ["Quickly", "Happy", "Tall", "Green"],
        correctAnswer: "Quickly",
        category: "English",
        difficulty: "medium",
        gradeLevel: 5,
      },
      {
        id: "english-q5",
        text: "Which sentence has correct punctuation?",
        options: ["Where are you going.", "where are you going?", "Where are you going?", "where are you going."],
        correctAnswer: "Where are you going?",
        category: "English",
        difficulty: "medium",
        gradeLevel: 5,
      },
    ],
  },
  {
    id: "gk-quiz-1",
    title: "General Knowledge",
    category: "General Knowledge",
    gradeLevel: 5,
    questions: [
      {
        id: "gk-q1",
        text: "What is the capital of Ethiopia?",
        options: ["Cairo", "Nairobi", "Addis Ababa", "Lagos"],
        correctAnswer: "Addis Ababa",
        category: "General Knowledge",
        difficulty: "medium",
        gradeLevel: 5,
      },
      {
        id: "gk-q2",
        text: "Which is the largest continent?",
        options: ["North America", "Europe", "Africa", "Asia"],
        correctAnswer: "Asia",
        category: "General Knowledge",
        difficulty: "easy",
        gradeLevel: 5,
      },
      {
        id: "gk-q3",
        text: "How many sides does a hexagon have?",
        options: ["5", "6", "7", "8"],
        correctAnswer: "6",
        category: "General Knowledge",
        difficulty: "easy",
        gradeLevel: 5,
      },
      {
        id: "gk-q4",
        text: "What is the currency of Japan?",
        options: ["Dollar", "Euro", "Yen", "Pound"],
        correctAnswer: "Yen",
        category: "General Knowledge",
        difficulty: "medium",
        gradeLevel: 5,
      },
      {
        id: "gk-q5",
        text: "Which famous inventor is known for the lightbulb?",
        options: ["Einstein", "Edison", "Tesla", "Graham Bell"],
        correctAnswer: "Edison",
        category: "General Knowledge",
        difficulty: "medium",
        gradeLevel: 5,
      },
    ],
  },
];

export const QuizProvider = ({ children }: { children: ReactNode }) => {
  const [quizzes] = useState<Quiz[]>(sampleQuizzes);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  // Helper function to shuffle an array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const getQuizzesByCategory = (category: string): Quiz[] => {
    return quizzes.filter(quiz => quiz.category.toLowerCase() === category.toLowerCase());
  };

  const getQuizzesByGrade = (grade: number): Quiz[] => {
    return quizzes.filter(quiz => quiz.gradeLevel === grade);
  };
  
  const getQuizzesByDifficulty = (difficulty: "easy" | "medium" | "hard"): Quiz[] => {
    // This returns quizzes where most questions match the requested difficulty
    return quizzes.filter(quiz => {
      const questions = quiz.questions;
      const matchingDifficulty = questions.filter(q => q.difficulty === difficulty).length;
      return matchingDifficulty >= questions.length / 2;
    });
  };
  
  const createRandomQuiz = (category: string, count: number, gradeLevel: number): Quiz | null => {
    // Get all questions that match the category and grade level
    const allQuestions = quizzes
      .filter(quiz => quiz.category.toLowerCase() === category.toLowerCase())
      .flatMap(quiz => quiz.questions)
      .filter(q => q.gradeLevel === gradeLevel);
    
    if (allQuestions.length === 0) return null;
    
    // Shuffle and take requested number of questions (or as many as available)
    const randomQuestions = shuffleArray(allQuestions).slice(0, count);
    
    if (randomQuestions.length === 0) return null;
    
    // Create a new randomized quiz
    return {
      id: `random-${category.toLowerCase()}-${Date.now()}`,
      title: `Random ${category} Quiz`,
      category: category,
      questions: randomQuestions,
      gradeLevel: gradeLevel
    };
  };

  return (
    <QuizContext.Provider
      value={{
        quizzes,
        activeQuiz,
        setActiveQuiz,
        getQuizzesByCategory,
        getQuizzesByGrade,
        getQuizzesByDifficulty,
        createRandomQuiz,
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
