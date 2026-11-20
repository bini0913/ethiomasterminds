import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from './UserContext';

// Define the Question and Quiz types
export interface Question {
  id: string;
  text: string;
  options: string[];
  /** Only populated by authorized authoring workflows, never by student quiz reads. */
  correctAnswer?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme';
  subject: string;
  grade: number;
  topic: string;
  type: 'Multiple Choice' | 'True/False' | 'Fill in the blank' | 'Matching';
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
  loadError: string | null;
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
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch quizzes from database - approved quizzes only
  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Fetch approved quizzes with their questions
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (quizzesError) {
        console.error('Error fetching quizzes:', quizzesError);
        throw quizzesError;
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
        .select('id,quiz_id,question_text,options,difficulty,points,topic,question_type,explanation,order_index')
        .in('quiz_id', quizIds)
        .order('order_index');

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        throw questionsError;
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
          difficulty: (
            q.difficulty
              ? (q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1).toLowerCase())
              : (q.points >= 20 ? 'Extreme' : q.points >= 15 ? 'Hard' : q.points >= 10 ? 'Medium' : 'Easy')
          ) as 'Easy' | 'Medium' | 'Hard' | 'Extreme',
          subject: '', // Will be set from quiz
          grade: 0, // Will be set from quiz
          topic: typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : 'General',
          type: (() => {
            const rawType = String(q.question_type ?? q.type ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
            if (rawType.includes('true') && rawType.includes('false')) return 'True/False';
            if (rawType.includes('fill')) return 'Fill in the blank';
            if (rawType.includes('match')) return 'Matching';
            const optionLabels = options.map((option) => String(option).trim().toLowerCase());
            if (optionLabels.length === 2 && optionLabels.includes('true') && optionLabels.includes('false')) return 'True/False';
            return 'Multiple Choice';
          })(),
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
          topics: Array.from(new Set(questions.map((question) => question.topic).filter(Boolean))),
          category: q.subject,
          gradeLevel: gradeNum
        };
      });

      const nonEmptyMappedQuizzes = mappedQuizzes.filter((quiz) => quiz.questions.length > 0);
      setQuizzes(nonEmptyMappedQuizzes);
      setFilteredQuizzes(nonEmptyMappedQuizzes);
    } catch (err) {
      console.error('Error in fetchQuizzes:', err);
      setLoadError('The approved quiz bank could not be loaded. Please retry.');
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
    
    // Keep each generated practice set inside one real source quiz. The
    // secure submission RPC validates every question against that source quiz.
    const sourceQuizzes = quizzes.filter(quiz => {
      const categoryMatches = category === 'all' || quiz.subject.toLowerCase() === category.toLowerCase();
      const gradeMatches = !grade || quiz.grade === grade;
      const difficultyMatches = !difficulty || quiz.difficulty === properDifficulty;
      return categoryMatches && gradeMatches && difficultyMatches;
    });
    const sourceQuiz = sourceQuizzes.length > 0
      ? sourceQuizzes[Math.floor(Math.random() * sourceQuizzes.length)]
      : null;

    // Filter out already asked questions from the selected real source quiz.
    const availableQuestions = (sourceQuiz?.questions || [])
      .filter(question => !askedQuestions.includes(question.id));

    // Shuffle and pick only from that source quiz.
    const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    // Never fabricate questions. Every student question must come from approved
    // curriculum content so secure submission/reward logic always has a real question id.
    if (selected.length < count) {
      console.warn(`Requested ${count} questions but only ${selected.length} approved questions are available for this selection.`);
    }

    return {
      id: `quiz-${Math.random().toString(36).substring(2, 9)}`,
      sourceQuizId: sourceQuiz?.id,
      title: `${category} Quiz - Grade ${grade || sourceQuiz?.grade || 5}`,
      description: `A ${properDifficulty} quiz about ${category}`,
      questions: selected,
      subject: sourceQuiz?.subject || category,
      grade: sourceQuiz?.grade || grade || 5,
      difficulty: sourceQuiz?.difficulty || properDifficulty,
      timeLimit: selected.length * 30,
      createdBy: sourceQuiz?.createdBy,
      createdAt: new Date(),
      topics: sourceQuiz?.topics || [topic || 'General'],
      category: sourceQuiz?.category || category,
      gradeLevel: sourceQuiz?.gradeLevel || grade || 5
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
      filtered = filtered.filter((quiz) => quiz.subject === filters.subject);
    }

    if (filters.grade) {
      const gradeNum = Number.parseInt(filters.grade, 10);
      if (Number.isFinite(gradeNum)) filtered = filtered.filter((quiz) => quiz.grade === gradeNum);
    }

    if (filters.difficulty) {
      const wantedDifficulty = filters.difficulty.trim().toLowerCase();
      filtered = filtered.filter((quiz) => quiz.difficulty.toLowerCase() === wantedDifficulty);
    }

    if (filters.topic || filters.questionType) {
      filtered = filtered.map((quiz) => {
        const matchingQuestions = quiz.questions.filter((question) =>
          (!filters.topic || question.topic.toLowerCase() === filters.topic!.trim().toLowerCase()) &&
          (!filters.questionType || question.type === filters.questionType)
        );
        return {
          ...quiz,
          questions: matchingQuestions,
          topics: Array.from(new Set(matchingQuestions.map((question) => question.topic).filter(Boolean))),
        };
      }).filter((quiz) => quiz.questions.length > 0);
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
    loading,
    loadError,
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
