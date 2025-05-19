
import React, { createContext, useContext, useState, ReactNode } from "react";

// Define types for quiz questions
export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string | string[];
  explanation?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  grade: string;
  subject: string;
  topic: string;
  type: "Multiple Choice" | "True/False" | "Fill in the Blank" | "Matching";
  image?: string;
};

export type QuizFilters = {
  grade?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  questionType?: string;
};

interface QuizContextType {
  currentQuestion: QuizQuestion | null;
  setCurrentQuestion: (question: QuizQuestion | null) => void;
  questions: QuizQuestion[];
  setQuestions: (questions: QuizQuestion[]) => void;
  askQuestion: (excludeIds?: string[]) => QuizQuestion | null;
  addQuestion: (question: QuizQuestion) => void;
  updateQuestion: (question: QuizQuestion) => void;
  deleteQuestion: (id: string) => void;
  askedQuestions: QuizQuestion[];
  clearAskedQuestions: () => void;
  quizFilters: QuizFilters;
  setQuizFilters: (filters: QuizFilters) => void;
  getFilteredQuestions: (filters: QuizFilters) => QuizQuestion[];
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

// Sample questions with improved structure
const sampleQuestions: QuizQuestion[] = [
  {
    id: "q1",
    question: "What is 5 + 7?",
    options: ["10", "12", "15", "18"],
    correctAnswer: "12",
    difficulty: "Easy",
    grade: "3",
    subject: "Mathematics",
    topic: "Numbers",
    type: "Multiple Choice"
  },
  {
    id: "q2",
    question: "The Earth revolves around the Sun.",
    options: ["True", "False"],
    correctAnswer: "True",
    explanation: "The Earth orbits the Sun in approximately 365.25 days.",
    difficulty: "Easy",
    grade: "4",
    subject: "Science",
    topic: "Astronomy",
    type: "True/False"
  },
  {
    id: "q3",
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctAnswer: "Paris",
    difficulty: "Medium",
    grade: "5",
    subject: "Social Studies",
    topic: "Geography",
    type: "Multiple Choice"
  },
  {
    id: "q4",
    question: "Which word is a synonym for 'happy'?",
    options: ["Sad", "Angry", "Joyful", "Tired"],
    correctAnswer: "Joyful",
    difficulty: "Medium",
    grade: "4",
    subject: "English",
    topic: "Vocabulary",
    type: "Multiple Choice"
  },
  {
    id: "q5",
    question: "What is 8 × 9?",
    options: ["63", "72", "81", "90"],
    correctAnswer: "72",
    difficulty: "Medium",
    grade: "4",
    subject: "Mathematics",
    topic: "Numbers",
    type: "Multiple Choice"
  },
  {
    id: "q6",
    question: "Water boils at 100°C at sea level.",
    options: ["True", "False"],
    correctAnswer: "True",
    explanation: "Water boils at 100 degrees Celsius (212°F) at standard atmospheric pressure at sea level.",
    difficulty: "Easy",
    grade: "5",
    subject: "Science",
    topic: "Physics",
    type: "True/False"
  },
  {
    id: "q7",
    question: "Complete the sentence: The cat sat ___ the mat.",
    options: ["on", "in", "at", "by"],
    correctAnswer: "on",
    difficulty: "Easy",
    grade: "3",
    subject: "English",
    topic: "Grammar",
    type: "Fill in the Blank"
  },
  {
    id: "q8",
    question: "What is the largest planet in our solar system?",
    options: ["Earth", "Mars", "Jupiter", "Saturn"],
    correctAnswer: "Jupiter",
    difficulty: "Medium",
    grade: "5",
    subject: "Science",
    topic: "Astronomy",
    type: "Multiple Choice"
  },
  {
    id: "q9",
    question: "Which of these is NOT a primary color?",
    options: ["Red", "Blue", "Green", "Yellow"],
    correctAnswer: "Green",
    difficulty: "Medium",
    grade: "4",
    subject: "Science",
    topic: "Physics",
    type: "Multiple Choice"
  },
  {
    id: "q10",
    question: "Who wrote 'Romeo and Juliet'?",
    options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
    correctAnswer: "William Shakespeare",
    difficulty: "Hard",
    grade: "7",
    subject: "English",
    topic: "Literature",
    type: "Multiple Choice"
  }
];

// Generate 50 more questions across different grades, subjects, and difficulties
const generateMoreQuestions = (): QuizQuestion[] => {
  const extraQuestions: QuizQuestion[] = [];
  const subjects = ["Mathematics", "Science", "English", "Social Studies", "General Knowledge"];
  const topics: { [key: string]: string[] } = {
    "Mathematics": ["Numbers", "Algebra", "Geometry", "Fractions", "Decimals"],
    "Science": ["Biology", "Chemistry", "Physics", "Earth Science", "Astronomy"],
    "English": ["Grammar", "Vocabulary", "Reading", "Writing", "Literature"],
    "Social Studies": ["History", "Geography", "Civics", "Economics"],
    "General Knowledge": ["Current Affairs", "Sports", "Arts", "Technology"]
  };
  const difficulties = ["Easy", "Medium", "Hard"];
  const types = ["Multiple Choice", "True/False", "Fill in the Blank", "Matching"];
  
  // Add 50 questions (5 per grade for grades 1-10)
  for (let grade = 1; grade <= 10; grade++) {
    for (let i = 0; i < 5; i++) {
      const subjectIndex = Math.floor(Math.random() * subjects.length);
      const subject = subjects[subjectIndex];
      const topicArray = topics[subject];
      const topic = topicArray[Math.floor(Math.random() * topicArray.length)];
      const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
      const type = types[Math.floor(Math.random() * types.length)] as "Multiple Choice" | "True/False" | "Fill in the Blank" | "Matching";
      
      let question: string;
      let options: string[];
      let correctAnswer: string;
      
      // Generate content based on subject
      switch (subject) {
        case "Mathematics":
          if (grade <= 3) {
            // Basic addition/subtraction for lower grades
            const num1 = Math.floor(Math.random() * 10) + 1;
            const num2 = Math.floor(Math.random() * 10) + 1;
            question = `What is ${num1} + ${num2}?`;
            correctAnswer = (num1 + num2).toString();
            options = [
              correctAnswer,
              (num1 + num2 + 1).toString(),
              (num1 + num2 - 1).toString(),
              (num1 + num2 + 2).toString()
            ].sort(() => Math.random() - 0.5);
          } else if (grade <= 6) {
            // Multiplication/division for middle grades
            const num1 = Math.floor(Math.random() * 12) + 1;
            const num2 = Math.floor(Math.random() * 12) + 1;
            question = `What is ${num1} × ${num2}?`;
            correctAnswer = (num1 * num2).toString();
            options = [
              correctAnswer,
              (num1 * num2 + Math.floor(Math.random() * 5) + 1).toString(),
              (num1 * num2 - Math.floor(Math.random() * 5) - 1).toString(),
              (num1 * (num2 + 1)).toString()
            ].sort(() => Math.random() - 0.5);
          } else {
            // Basic algebra for higher grades
            const a = Math.floor(Math.random() * 5) + 1;
            const b = Math.floor(Math.random() * 10) + 5;
            question = `Solve for x: ${a}x = ${a * b}`;
            correctAnswer = b.toString();
            options = [
              correctAnswer,
              (b + 1).toString(),
              (b - 1).toString(),
              (b + 2).toString()
            ].sort(() => Math.random() - 0.5);
          }
          break;
          
        case "Science":
          if (topic === "Biology") {
            const biologyQuestions = [
              "Which organ pumps blood through the body?",
              "What do plants use to make their food?",
              "Which gas do humans breathe out?",
              "What is the process called when plants make their own food?"
            ];
            const biologyAnswers = ["Heart", "Sunlight", "Carbon dioxide", "Photosynthesis"];
            const wrongAnswers = [
              ["Lungs", "Brain", "Stomach"],
              ["Water", "Soil", "Air"],
              ["Oxygen", "Nitrogen", "Hydrogen"],
              ["Respiration", "Digestion", "Circulation"]
            ];
            
            const qIndex = Math.floor(Math.random() * biologyQuestions.length);
            question = biologyQuestions[qIndex];
            correctAnswer = biologyAnswers[qIndex];
            options = [correctAnswer, ...wrongAnswers[qIndex]].sort(() => Math.random() - 0.5);
          } else {
            const scienceQuestions = [
              "Which planet is closest to the sun?",
              "What state of matter is water at room temperature?",
              "What force pulls objects toward Earth?"
            ];
            const scienceAnswers = ["Mercury", "Liquid", "Gravity"];
            const wrongAnswers = [
              ["Venus", "Earth", "Mars"],
              ["Solid", "Gas", "Plasma"],
              ["Magnetism", "Electricity", "Friction"]
            ];
            
            const qIndex = Math.floor(Math.random() * scienceQuestions.length);
            question = scienceQuestions[qIndex];
            correctAnswer = scienceAnswers[qIndex];
            options = [correctAnswer, ...wrongAnswers[qIndex]].sort(() => Math.random() - 0.5);
          }
          break;
          
        default:
          // General knowledge for other subjects
          const generalQuestions = [
            "Which is the largest ocean on Earth?",
            "Who wrote the Harry Potter books?",
            "What is the capital of Ethiopia?",
            "Which language is spoken in Brazil?"
          ];
          const generalAnswers = ["Pacific Ocean", "J.K. Rowling", "Addis Ababa", "Portuguese"];
          const wrongAnswers = [
            ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"],
            ["Roald Dahl", "Enid Blyton", "C.S. Lewis"],
            ["Nairobi", "Cairo", "Lagos"],
            ["Spanish", "English", "French"]
          ];
          
          const qIndex = Math.floor(Math.random() * generalQuestions.length);
          question = generalQuestions[qIndex];
          correctAnswer = generalAnswers[qIndex];
          options = [correctAnswer, ...wrongAnswers[qIndex]].sort(() => Math.random() - 0.5);
      }
      
      extraQuestions.push({
        id: `ex-q${grade}-${i}`,
        question,
        options,
        correctAnswer,
        difficulty: difficulty as "Easy" | "Medium" | "Hard",
        grade: grade.toString(),
        subject,
        topic,
        type
      });
    }
  }
  
  return extraQuestions;
};

export const QuizProvider = ({ children }: { children: ReactNode }) => {
  // Combine sample questions with generated ones
  const allQuestions = [...sampleQuestions, ...generateMoreQuestions()];
  
  const [questions, setQuestions] = useState<QuizQuestion[]>(allQuestions);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [askedQuestions, setAskedQuestions] = useState<QuizQuestion[]>([]);
  const [quizFilters, setQuizFilters] = useState<QuizFilters>({});
  
  // Add a new question
  const addQuestion = (question: QuizQuestion) => {
    setQuestions([...questions, question]);
  };
  
  // Update an existing question
  const updateQuestion = (updatedQuestion: QuizQuestion) => {
    setQuestions(
      questions.map(q => (q.id === updatedQuestion.id ? updatedQuestion : q))
    );
  };
  
  // Delete a question
  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };
  
  // Get questions that match the filters
  const getFilteredQuestions = (filters: QuizFilters): QuizQuestion[] => {
    return questions.filter(q => {
      // Check each filter criterion
      if (filters.grade && q.grade !== filters.grade) return false;
      if (filters.subject && q.subject !== filters.subject) return false;
      if (filters.topic && q.topic !== filters.topic) return false;
      if (filters.difficulty && q.difficulty !== filters.difficulty) return false;
      if (filters.questionType && q.type !== filters.questionType) return false;
      
      return true;
    });
  };
  
  // Ask a new question, excluding any questions with IDs in the excludeIds array
  const askQuestion = (excludeIds: string[] = []): QuizQuestion | null => {
    // Get questions that match current filters
    const filteredQuestions = getFilteredQuestions(quizFilters);
    
    // Further filter to exclude already asked questions and specified IDs
    const availableQuestions = filteredQuestions.filter(
      q => 
        !askedQuestions.some(aq => aq.id === q.id) && 
        !excludeIds.includes(q.id)
    );
    
    if (availableQuestions.length === 0) {
      // If no questions are available, clear asked questions and try again
      // (but still respect the excludeIds parameter)
      const resetAvailableQuestions = filteredQuestions.filter(
        q => !excludeIds.includes(q.id)
      );
      
      if (resetAvailableQuestions.length === 0) {
        return null; // No questions available even after resetting
      }
      
      // Reset asked questions and pick a new one
      setAskedQuestions([]);
      const randomIndex = Math.floor(Math.random() * resetAvailableQuestions.length);
      const newQuestion = resetAvailableQuestions[randomIndex];
      setCurrentQuestion(newQuestion);
      setAskedQuestions([newQuestion]);
      return newQuestion;
    }
    
    // Pick a random question from available ones
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const newQuestion = availableQuestions[randomIndex];
    setCurrentQuestion(newQuestion);
    setAskedQuestions(prev => [...prev, newQuestion]);
    return newQuestion;
  };
  
  // Clear the list of asked questions to start fresh
  const clearAskedQuestions = () => {
    setAskedQuestions([]);
  };
  
  return (
    <QuizContext.Provider
      value={{
        currentQuestion,
        setCurrentQuestion,
        questions,
        setQuestions,
        askQuestion,
        addQuestion,
        updateQuestion,
        deleteQuestion,
        askedQuestions,
        clearAskedQuestions,
        quizFilters,
        setQuizFilters,
        getFilteredQuestions
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
