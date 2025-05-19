
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the Question and Quiz types that were missing
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  subject: string;
  grade: number;
  topic: string;
  type: 'Multiple Choice' | 'True/False' | 'Fill in the blank';
  points: number;
  timeLimit?: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  subject: string;
  grade: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeLimit?: number;
  createdBy?: string;
  createdAt: Date;
  topics?: string[];
}

// Define the context type that's used throughout the application
export interface QuizContextType {
  quizzes: Quiz[];
  currentQuiz: Quiz | null;
  setCurrentQuiz: (quiz: Quiz | null) => void;
  createRandomQuiz: (count: number, subject?: string, grade?: number, difficulty?: 'Easy' | 'Medium' | 'Hard', topic?: string) => Quiz;
  createQuiz: (quiz: Quiz) => void;
  updateQuiz: (quiz: Quiz) => void;
  deleteQuiz: (id: string) => void;
  fetchQuizzes: () => void;
  askedQuestions: string[];
  addAskedQuestion: (questionId: string) => void;
  filteredQuizzes: Quiz[];
  setFilteredQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>;
  filterQuizzes: (subject?: string, grade?: number, difficulty?: string, topic?: string) => void;
}

// Create a dummy quiz generator function
const generateRandomQuiz = (
  count: number, 
  subject = 'General Knowledge', 
  grade = 5, 
  difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium',
  topic = 'General'
): Quiz => {
  const questions = [];
  const types = ['Multiple Choice', 'True/False', 'Fill in the blank'] as const;
  
  for (let i = 0; i < count; i++) {
    const questionType = types[Math.floor(Math.random() * types.length)] as 'Multiple Choice' | 'True/False' | 'Fill in the blank';
    const options = questionType === 'Multiple Choice' 
      ? ['Option A', 'Option B', 'Option C', 'Option D'] 
      : questionType === 'True/False' 
        ? ['True', 'False'] 
        : [];
    
    questions.push({
      id: `q-${Math.random().toString(36).substr(2, 9)}`,
      text: `Sample ${subject} question #${i+1} for grade ${grade} (${difficulty})`,
      options,
      correctAnswer: options.length > 0 ? options[Math.floor(Math.random() * options.length)] : '',
      difficulty,
      subject,
      grade,
      topic,
      type: questionType,
      points: difficulty === 'Easy' ? 5 : difficulty === 'Medium' ? 10 : 15,
      timeLimit: 30,
      explanation: 'This is a sample explanation for this question.'
    });
  }
  
  return {
    id: `quiz-${Math.random().toString(36).substr(2, 9)}`,
    title: `${subject} Quiz - Grade ${grade} - ${topic}`,
    description: `A ${difficulty} quiz about ${subject} for Grade ${grade} students focusing on ${topic}.`,
    questions,
    subject,
    grade,
    difficulty,
    timeLimit: count * 30,
    createdAt: new Date(),
    topics: [topic]
  };
};

// Generate some initial quizzes for different subjects and grades
const initialQuizzes: Quiz[] = [
  generateRandomQuiz(10, 'Mathematics', 5, 'Medium', 'Algebra'),
  generateRandomQuiz(10, 'Science', 6, 'Medium', 'Biology'),
  generateRandomQuiz(10, 'English', 4, 'Easy', 'Grammar'),
  generateRandomQuiz(10, 'General Knowledge', 7, 'Hard', 'History'),
  generateRandomQuiz(10, 'Mathematics', 3, 'Easy', 'Geometry'),
  generateRandomQuiz(10, 'Science', 8, 'Hard', 'Chemistry'),
  generateRandomQuiz(10, 'English', 5, 'Medium', 'Literature'),
  generateRandomQuiz(10, 'General Knowledge', 4, 'Easy', 'Geography'),
];

// Create the context with a default undefined value
const QuizContext = createContext<QuizContextType | undefined>(undefined);

// Provider component
export const QuizProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);

  const createQuiz = (quiz: Quiz) => {
    setQuizzes(prev => [...prev, quiz]);
  };

  const updateQuiz = (updatedQuiz: Quiz) => {
    setQuizzes(prev => 
      prev.map(quiz => quiz.id === updatedQuiz.id ? updatedQuiz : quiz)
    );
  };

  const deleteQuiz = (id: string) => {
    setQuizzes(prev => prev.filter(quiz => quiz.id !== id));
  };

  const createRandomQuiz = (
    count: number, 
    subject?: string, 
    grade?: number, 
    difficulty?: 'Easy' | 'Medium' | 'Hard',
    topic?: string
  ): Quiz => {
    // Filter out questions that have been asked before
    const newQuiz = generateRandomQuiz(
      count, 
      subject || 'General Knowledge', 
      grade || 5, 
      difficulty || 'Medium',
      topic || 'General'
    );
    
    // Ensure no repeated questions by filtering out previously asked ones
    newQuiz.questions = newQuiz.questions.filter(
      q => !askedQuestions.includes(q.id)
    );
    
    // If we have filtered out too many questions, generate new ones
    while (newQuiz.questions.length < count) {
      const additionalQ = generateRandomQuiz(
        count - newQuiz.questions.length, 
        subject || 'General Knowledge', 
        grade || 5, 
        difficulty || 'Medium',
        topic || 'General'
      ).questions;
      
      // Add only questions that haven't been asked before
      newQuiz.questions.push(
        ...additionalQ.filter(q => !askedQuestions.includes(q.id))
      );
    }
    
    // Mark all questions in this quiz as "asked"
    const newAskedQuestions = [
      ...askedQuestions,
      ...newQuiz.questions.map(q => q.id)
    ];
    setAskedQuestions(newAskedQuestions);
    
    createQuiz(newQuiz);
    return newQuiz;
  };

  const fetchQuizzes = () => {
    // In a real app, this would be an API call
    console.log("Fetching quizzes...");
    // For now, we're just using the initial data
  };

  const addAskedQuestion = (questionId: string) => {
    setAskedQuestions(prev => [...prev, questionId]);
  };

  const filterQuizzes = (
    subject?: string, 
    grade?: number, 
    difficulty?: string, 
    topic?: string
  ) => {
    let filtered = [...quizzes];
    
    if (subject) {
      filtered = filtered.filter(quiz => quiz.subject === subject);
    }
    
    if (grade) {
      filtered = filtered.filter(quiz => quiz.grade === grade);
    }
    
    if (difficulty) {
      filtered = filtered.filter(quiz => quiz.difficulty === difficulty);
    }
    
    if (topic) {
      filtered = filtered.filter(
        quiz => quiz.topics && quiz.topics.includes(topic)
      );
    }
    
    setFilteredQuizzes(filtered);
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Make sure filterQuizzes gets called when quizzes change
  useEffect(() => {
    setFilteredQuizzes(quizzes);
  }, [quizzes]);

  const value = {
    quizzes,
    currentQuiz,
    setCurrentQuiz,
    createRandomQuiz,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    fetchQuizzes,
    askedQuestions,
    addAskedQuestion,
    filteredQuizzes,
    setFilteredQuizzes,
    filterQuizzes
  };

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
};

// Hook to use the quiz context
export const useQuiz = (): QuizContextType => {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
};
