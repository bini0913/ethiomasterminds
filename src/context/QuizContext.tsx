import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from './UserContext';

// Define the Question and Quiz types
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme';
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
  sourceQuizId?: string;
  title: string;
  description: string;
  questions: Question[];
  subject: string;
  grade: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme';
  timeLimit?: number;
  createdBy?: string;
  createdAt: Date;
  topics?: string[];
  category: string;
  gradeLevel: number;
}

// Define the context type
export interface QuizContextType {
  quizzes: Quiz[];
  currentQuiz: Quiz | null;
  setCurrentQuiz: (quiz: Quiz | null) => void;
  createRandomQuiz: (category: string, count: number, grade?: number, difficulty?: 'easy' | 'medium' | 'hard' | 'extreme', topic?: string) => Quiz;
  createQuiz: (quiz: Quiz) => void;
  updateQuiz: (quiz: Quiz) => void;
  deleteQuiz: (id: string) => void;
  fetchQuizzes: () => Promise<void>;
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
  getAvailableSubjects: () => string[];
  getAvailableTopics: (subject?: string) => string[];
  getAvailableGrades: () => number[];
  loading: boolean;
}

// Create the context with a default undefined value
const QuizContext = createContext<QuizContextType | undefined>(undefined);

// Provider component
export const QuizProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [filteredQuizzes, setFilteredQuizzes] = useState<Quiz[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch quizzes from database - approved quizzes only
  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch approved quizzes with their questions
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (quizzesError) {
        console.error('Error fetching quizzes:', quizzesError);
        setLoading(false);
        return;
      }

      if (!quizzesData || quizzesData.length === 0) {
        setQuizzes([]);
        setFilteredQuizzes([]);
        setLoading(false);
        return;
      }

      // Fetch questions for all quizzes
      const quizIds = quizzesData.map(q => q.id);
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .in('quiz_id', quizIds)
        .order('order_index');

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
      }

      // Group questions by quiz_id
      const questionsByQuiz: Record<string, Question[]> = {};
      (questionsData || []).forEach((q: any) => {
        if (!questionsByQuiz[q.quiz_id]) {
          questionsByQuiz[q.quiz_id] = [];
        }
        const options = Array.isArray(q.options) ? q.options as string[] : [];
        questionsByQuiz[q.quiz_id].push({
          id: q.id,
          text: q.question_text,
          options,
          correctAnswer: q.correct_answer,
          difficulty: (
            q.difficulty
              ? (q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1).toLowerCase())
              : (q.points >= 20 ? 'Extreme' : q.points >= 15 ? 'Hard' : q.points >= 10 ? 'Medium' : 'Easy')
          ) as 'Easy' | 'Medium' | 'Hard' | 'Extreme',
          subject: '', // Will be set from quiz
          grade: 0, // Will be set from quiz
          topic: 'General',
          type: options.length === 2 ? 'True/False' : 'Multiple Choice',
          points: q.points || 10,
          timeLimit: 30,
          explanation: q.explanation || ''
        });
      });

      // Map database quizzes to our Quiz format
      const mappedQuizzes: Quiz[] = quizzesData.map((q: any) => {
        const questions = questionsByQuiz[q.id] || [];
        const gradeNum = parseInt(q.grade) || 5;
        
        // Set subject and grade on each question
        questions.forEach(question => {
          question.subject = q.subject;
          question.grade = gradeNum;
        });

        return {
          id: q.id,
          title: q.title,
          description: q.description || '',
          questions,
          subject: q.subject,
          grade: gradeNum,
          difficulty: (
            q.difficulty === 'easy'
              ? 'Easy'
              : q.difficulty === 'hard'
                ? 'Hard'
                : q.difficulty === 'extreme'
                  ? 'Extreme'
                  : 'Medium'
          ) as 'Easy' | 'Medium' | 'Hard' | 'Extreme',
          timeLimit: q.time_limit || questions.length * 30,
          createdBy: q.created_by,
          createdAt: new Date(q.created_at),
          topics: ['General'],
          category: q.subject,
          gradeLevel: gradeNum
        };
      });

      const nonEmptyMappedQuizzes = mappedQuizzes.filter((quiz) => quiz.questions.length > 0);
      setQuizzes(nonEmptyMappedQuizzes);
      setFilteredQuizzes(nonEmptyMappedQuizzes);
    } catch (err) {
      console.error('Error in fetchQuizzes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a random quiz from available questions
  const generateRandomQuiz = (
    category: string,
    count: number, 
    grade?: number, 
    difficulty?: 'easy' | 'medium' | 'hard' | 'extreme',
    topic?: string
  ): Quiz => {
    const difficultyMapping: Record<string, 'Easy' | 'Medium' | 'Hard' | 'Extreme'> = {
      'easy': 'Easy',
      'medium': 'Medium',
      'hard': 'Hard',
      'extreme': 'Extreme'
    };
    
    const properDifficulty = difficulty ? difficultyMapping[difficulty] : 'Medium';
    
    // Filter available questions from existing quizzes
    let availableQuestions: Question[] = [];
    quizzes.forEach(quiz => {
      if (category === 'all' || quiz.subject.toLowerCase() === category.toLowerCase()) {
        if (!grade || quiz.grade === grade) {
          if (!difficulty || quiz.difficulty === properDifficulty) {
            availableQuestions.push(...quiz.questions);
          }
        }
      }
    });

    // Filter out already asked questions
    availableQuestions = availableQuestions.filter(q => !askedQuestions.includes(q.id));

    // Shuffle and pick
    const shuffled = availableQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    // If not enough questions, generate placeholders
    while (selected.length < count) {
      const types = ['Multiple Choice', 'True/False'] as const;
      const questionType = types[Math.floor(Math.random() * types.length)];
      const options = questionType === 'Multiple Choice' 
        ? ['Option A', 'Option B', 'Option C', 'Option D'] 
        : ['True', 'False'];
      
      selected.push({
        id: `q-${Math.random().toString(36).substr(2, 9)}`,
        text: `${category} question for grade ${grade || 5} (${properDifficulty})`,
        options,
        correctAnswer: options[0],
        difficulty: properDifficulty,
        subject: category,
        grade: grade || 5,
        topic: topic || 'General',
        type: questionType,
        points: properDifficulty === 'Easy' ? 5 : properDifficulty === 'Medium' ? 10 : properDifficulty === 'Hard' ? 15 : 20,
        timeLimit: 30,
        explanation: ''
      });
    }
    
    return {
      id: `quiz-${Math.random().toString(36).substring(2, 9)}`,
      title: `${category} Quiz - Grade ${grade || 5}`,
      description: `A ${properDifficulty} quiz about ${category}`,
      questions: selected,
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
    difficulty?: 'easy' | 'medium' | 'hard' | 'extreme',
    topic?: string
  ): Quiz => {
    const newQuiz = generateRandomQuiz(category, count, grade, difficulty, topic);
    
    // Mark questions as asked
    const newAskedQuestions = [...askedQuestions, ...newQuiz.questions.map(q => q.id)];
    setAskedQuestions(newAskedQuestions);
    
    return newQuiz;
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
  
  const getAvailableSubjects = () => {
    const subjects = new Set<string>();
    quizzes.forEach(quiz => subjects.add(quiz.subject));
    return Array.from(subjects);
  };
  
  const getAvailableTopics = (subject?: string) => {
    const topics = new Set<string>();
    quizzes.forEach(quiz => {
      if (!subject || quiz.subject === subject) {
        quiz.topics?.forEach(topic => topics.add(topic));
      }
    });
    return Array.from(topics);
  };
  
  const getAvailableGrades = () => {
    const grades = new Set<number>();
    quizzes.forEach(quiz => grades.add(quiz.grade));
    return Array.from(grades).sort((a, b) => a - b);
  };

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  // Set up realtime subscription for new approved quizzes
  useEffect(() => {
    const channel = supabase
      .channel('quiz-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quizzes',
        filter: 'is_approved=eq.true'
      }, () => {
        fetchQuizzes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQuizzes]);

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
    setQuizFilters,
    getAvailableSubjects,
    getAvailableTopics,
    getAvailableGrades,
    loading
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
