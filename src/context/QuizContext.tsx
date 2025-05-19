
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
  category: string;
  gradeLevel: number;
}

// Define the context type that's used throughout the application
export interface QuizContextType {
  quizzes: Quiz[];
  currentQuiz: Quiz | null;
  setCurrentQuiz: (quiz: Quiz | null) => void;
  createRandomQuiz: (category: string, count: number, grade?: number, difficulty?: 'easy' | 'medium' | 'hard', topic?: string) => Quiz;
  createQuiz: (quiz: Quiz) => void;
  updateQuiz: (quiz: Quiz) => void;
  deleteQuiz: (id: string) => void;
  fetchQuizzes: () => void;
  askedQuestions: string[];
  addAskedQuestion: (questionId: string) => void;
  filteredQuizzes: Quiz[];
  setFilteredQuizzes: React.Dispatch<React.SetStateAction<Quiz[]>>;
  filterQuizzes: (subject?: string, grade?: number, difficulty?: string, topic?: string) => void;
  setQuizFilters: (filters: { 
    grade?: string;
    subject?: string;
    topic?: string;
    difficulty?: string;
    questionType?: string;
  }) => void;
}

// Create a dummy quiz generator function
const generateRandomQuiz = (
  category: string,
  count: number, 
  grade?: number, 
  difficulty?: 'easy' | 'medium' | 'hard',
  topic?: string
): Quiz => {
  // Convert difficulty from lowercase to proper case for internal use
  const difficultyMapping: Record<string, 'Easy' | 'Medium' | 'Hard'> = {
    'easy': 'Easy',
    'medium': 'Medium',
    'hard': 'Hard'
  };
  
  const properDifficulty = difficulty ? difficultyMapping[difficulty] : 'Medium';
  
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
      text: `Sample ${category} question #${i+1} for grade ${grade} (${properDifficulty})`,
      options,
      correctAnswer: options.length > 0 ? options[Math.floor(Math.random() * options.length)] : '',
      difficulty: properDifficulty,
      subject: category,
      grade: grade || 5,
      topic: topic || 'General',
      type: questionType,
      points: properDifficulty === 'Easy' ? 5 : properDifficulty === 'Medium' ? 10 : 15,
      timeLimit: 30,
      explanation: 'This is a sample explanation for this question.'
    });
  }
  
  return {
    id: `quiz-${Math.random().toString(36).substr(2, 9)}`,
    title: `${category} Quiz - Grade ${grade || 5} - ${topic || 'General'}`,
    description: `A ${properDifficulty} quiz about ${category} for Grade ${grade || 5} students focusing on ${topic || 'General'}.`,
    questions,
    subject: category,
    grade: grade || 5,
    difficulty: properDifficulty,
    timeLimit: count * 30,
    createdAt: new Date(),
    topics: [topic || 'General'],
    category,
    gradeLevel: grade || 5
  };
};

// Generate some initial quizzes for different subjects and grades
const initialQuizzes: Quiz[] = [
  generateRandomQuiz('Mathematics', 10, 5, 'medium', 'Algebra'),
  generateRandomQuiz('Science', 10, 6, 'medium', 'Biology'),
  generateRandomQuiz('English', 10, 4, 'easy', 'Grammar'),
  generateRandomQuiz('General Knowledge', 10, 7, 'hard', 'History'),
  generateRandomQuiz('Mathematics', 10, 3, 'easy', 'Geometry'),
  generateRandomQuiz('Science', 10, 8, 'hard', 'Chemistry'),
  generateRandomQuiz('English', 10, 5, 'medium', 'Literature'),
  generateRandomQuiz('General Knowledge', 10, 4, 'easy', 'Geography'),
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
    category: string,
    count: number, 
    grade?: number, 
    difficulty?: 'easy' | 'medium' | 'hard',
  ): Quiz => {
    // Convert difficulty from lowercase to proper case for internal use
    const difficultyMapping: Record<string, 'Easy' | 'Medium' | 'Hard'> = {
      'easy': 'Easy',
      'medium': 'Medium',
      'hard': 'Hard'
    };
    
    const properDifficulty = difficulty ? difficultyMapping[difficulty] : 'Medium';
    const topic = 'General';
    
    // Filter out questions that have been asked before
    const newQuiz = generateRandomQuiz(
      category, 
      count, 
      grade || 5, 
      difficulty,
      topic
    );
    
    // Ensure no repeated questions by filtering out previously asked ones
    newQuiz.questions = newQuiz.questions.filter(
      q => !askedQuestions.includes(q.id)
    );
    
    // If we have filtered out too many questions, generate new ones
    while (newQuiz.questions.length < count) {
      const additionalQ = generateRandomQuiz(
        category, 
        count - newQuiz.questions.length, 
        grade || 5, 
        difficulty,
        topic
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

  const setQuizFilters = (filters: { 
    grade?: string;
    subject?: string;
    topic?: string;
    difficulty?: string;
    questionType?: string;
  }) => {
    let filtered = [...quizzes];
    
    if (filters.subject) {
      filtered = filtered.filter(quiz => quiz.subject === filters.subject);
    }
    
    if (filters.grade) {
      const gradeNum = parseInt(filters.grade);
      if (!isNaN(gradeNum)) {
        filtered = filtered.filter(quiz => quiz.grade === gradeNum);
      }
    }
    
    if (filters.difficulty) {
      filtered = filtered.filter(quiz => quiz.difficulty === filters.difficulty);
    }
    
    if (filters.topic) {
      filtered = filtered.filter(
        quiz => quiz.topics && quiz.topics.includes(filters.topic as string)
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
    filterQuizzes,
    setQuizFilters
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
