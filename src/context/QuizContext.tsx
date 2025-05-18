
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
  createRandomQuiz: (category: string, count: number, gradeLevel: number, difficulty?: "easy" | "medium" | "hard") => Quiz | null;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

// Expanded sample quiz data with questions for multiple grade levels
const sampleQuizzes: Quiz[] = [
  // Grade 1 Quizzes
  {
    id: "math-quiz-g1",
    title: "Basic Numbers",
    category: "Math",
    gradeLevel: 1,
    questions: [
      {
        id: "math-g1-q1",
        text: "What comes after 5?",
        options: ["4", "5", "6", "7"],
        correctAnswer: "6",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 1,
      },
      {
        id: "math-g1-q2",
        text: "How many sides does a triangle have?",
        options: ["2", "3", "4", "5"],
        correctAnswer: "3",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 1,
      },
      {
        id: "math-g1-q3",
        text: "Which shape is a circle?",
        options: ["◼️", "🔺", "⭐", "⚪"],
        correctAnswer: "⚪",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 1,
      },
      {
        id: "math-g1-q4",
        text: "What is 2 + 3?",
        options: ["4", "5", "6", "7"],
        correctAnswer: "5",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 1,
      },
      {
        id: "math-g1-q5",
        text: "Which number is bigger: 8 or 3?",
        options: ["3", "8", "They are the same", "Neither"],
        correctAnswer: "8",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 1,
      },
    ],
  },
  {
    id: "english-quiz-g1",
    title: "ABC Fun",
    category: "English",
    gradeLevel: 1,
    questions: [
      {
        id: "eng-g1-q1",
        text: "Which letter comes after A?",
        options: ["B", "C", "D", "Z"],
        correctAnswer: "B",
        category: "English",
        difficulty: "easy",
        gradeLevel: 1,
      },
      {
        id: "eng-g1-q2",
        text: "Which word starts with the letter C?",
        options: ["Apple", "Banana", "Cat", "Dog"],
        correctAnswer: "Cat",
        category: "English",
        difficulty: "easy",
        gradeLevel: 1,
      },
      {
        id: "eng-g1-q3",
        text: "How many letters are in the word 'dog'?",
        options: ["2", "3", "4", "5"],
        correctAnswer: "3",
        category: "English",
        difficulty: "easy",
        gradeLevel: 1,
      },
      {
        id: "eng-g1-q4",
        text: "Which is a color?",
        options: ["Apple", "Red", "Tree", "House"],
        correctAnswer: "Red",
        category: "English",
        difficulty: "easy",
        gradeLevel: 1,
      },
      {
        id: "eng-g1-q5",
        text: "Which word rhymes with 'cat'?",
        options: ["Dog", "Bat", "Pig", "Fish"],
        correctAnswer: "Bat",
        category: "English",
        difficulty: "easy",
        gradeLevel: 1,
      },
    ],
  },
  
  // Grade 2 Quizzes
  {
    id: "math-quiz-g2",
    title: "Addition & Subtraction",
    category: "Math",
    gradeLevel: 2,
    questions: [
      {
        id: "math-g2-q1",
        text: "What is 10 - 4?",
        options: ["4", "5", "6", "7"],
        correctAnswer: "6",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 2,
      },
      {
        id: "math-g2-q2",
        text: "If you have 5 apples and get 3 more, how many do you have?",
        options: ["7", "8", "9", "10"],
        correctAnswer: "8",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 2,
      },
      {
        id: "math-g2-q3",
        text: "What is double 7?",
        options: ["12", "13", "14", "15"],
        correctAnswer: "14",
        category: "Math",
        difficulty: "easy",
        gradeLevel: 2,
      },
      {
        id: "math-g2-q4",
        text: "20 - 7 = ?",
        options: ["12", "13", "14", "15"],
        correctAnswer: "13",
        category: "Math",
        difficulty: "medium",
        gradeLevel: 2,
      },
      {
        id: "math-g2-q5",
        text: "What is half of 18?",
        options: ["7", "8", "9", "10"],
        correctAnswer: "9",
        category: "Math",
        difficulty: "medium",
        gradeLevel: 2,
      },
    ],
  },
  
  // Grade 3 Quizzes
  {
    id: "science-quiz-g3",
    title: "Plants & Animals",
    category: "Science",
    gradeLevel: 3,
    questions: [
      {
        id: "sci-g3-q1",
        text: "Which part of the plant absorbs water from soil?",
        options: ["Leaves", "Stem", "Roots", "Flowers"],
        correctAnswer: "Roots",
        category: "Science",
        difficulty: "easy",
        gradeLevel: 3,
      },
      {
        id: "sci-g3-q2",
        text: "What do plants need to make their food?",
        options: ["Only water", "Only sunlight", "Water and sunlight", "Only soil"],
        correctAnswer: "Water and sunlight",
        category: "Science",
        difficulty: "easy",
        gradeLevel: 3,
      },
      {
        id: "sci-g3-q3",
        text: "Which animal lays eggs?",
        options: ["Dog", "Cat", "Chicken", "Cow"],
        correctAnswer: "Chicken",
        category: "Science",
        difficulty: "easy",
        gradeLevel: 3,
      },
      {
        id: "sci-g3-q4",
        text: "What helps birds to fly?",
        options: ["Scales", "Fur", "Feathers", "Fins"],
        correctAnswer: "Feathers",
        category: "Science",
        difficulty: "easy",
        gradeLevel: 3,
      },
      {
        id: "sci-g3-q5",
        text: "Which is not a living thing?",
        options: ["Tree", "Rock", "Dog", "Flower"],
        correctAnswer: "Rock",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 3,
      },
    ],
  },
  
  // Grade 4 Quizzes
  {
    id: "gk-quiz-g4",
    title: "World Geography",
    category: "General Knowledge",
    gradeLevel: 4,
    questions: [
      {
        id: "gk-g4-q1",
        text: "Which is the largest ocean on Earth?",
        options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
        correctAnswer: "Pacific Ocean",
        category: "General Knowledge",
        difficulty: "medium",
        gradeLevel: 4,
      },
      {
        id: "gk-g4-q2",
        text: "How many continents are there on Earth?",
        options: ["5", "6", "7", "8"],
        correctAnswer: "7",
        category: "General Knowledge",
        difficulty: "easy",
        gradeLevel: 4,
      },
      {
        id: "gk-g4-q3",
        text: "Which planet is closest to the Sun?",
        options: ["Earth", "Mars", "Venus", "Mercury"],
        correctAnswer: "Mercury",
        category: "General Knowledge",
        difficulty: "medium",
        gradeLevel: 4,
      },
      {
        id: "gk-g4-q4",
        text: "What is the capital of Japan?",
        options: ["Beijing", "Seoul", "Tokyo", "Bangkok"],
        correctAnswer: "Tokyo",
        category: "General Knowledge",
        difficulty: "medium",
        gradeLevel: 4,
      },
      {
        id: "gk-g4-q5",
        text: "Which is the longest river in the world?",
        options: ["Amazon", "Nile", "Mississippi", "Yangtze"],
        correctAnswer: "Nile",
        category: "General Knowledge",
        difficulty: "medium",
        gradeLevel: 4,
      },
    ],
  },
  
  // Grade 5 Quizzes - Keep the existing ones
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
  
  // Grade 6 Quizzes
  {
    id: "math-quiz-g6",
    title: "Fractions & Decimals",
    category: "Math",
    gradeLevel: 6,
    questions: [
      {
        id: "math-g6-q1",
        text: "Which decimal is equal to 1/2?",
        options: ["0.2", "0.25", "0.5", "0.75"],
        correctAnswer: "0.5",
        category: "Math",
        difficulty: "medium",
        gradeLevel: 6,
      },
      {
        id: "math-g6-q2",
        text: "What is 3/4 + 1/4?",
        options: ["1/2", "3/4", "1", "4/4"],
        correctAnswer: "1",
        category: "Math",
        difficulty: "medium",
        gradeLevel: 6,
      },
      {
        id: "math-g6-q3",
        text: "Which fraction is greater: 3/5 or 2/3?",
        options: ["3/5", "2/3", "They are equal", "Cannot be determined"],
        correctAnswer: "2/3",
        category: "Math",
        difficulty: "hard",
        gradeLevel: 6,
      },
      {
        id: "math-g6-q4",
        text: "What is 0.7 × 10?",
        options: ["0.07", "0.7", "7", "70"],
        correctAnswer: "7",
        category: "Math",
        difficulty: "medium",
        gradeLevel: 6,
      },
      {
        id: "math-g6-q5",
        text: "Convert 3/8 to a decimal.",
        options: ["0.375", "0.38", "0.35", "0.4"],
        correctAnswer: "0.375",
        category: "Math",
        difficulty: "hard",
        gradeLevel: 6,
      },
    ],
  },
  {
    id: "science-quiz-g6",
    title: "Earth & Space",
    category: "Science",
    gradeLevel: 6,
    questions: [
      {
        id: "sci-g6-q1",
        text: "What causes day and night on Earth?",
        options: ["Revolution around the Sun", "Rotation on its axis", "Moon's shadow", "Clouds blocking sunlight"],
        correctAnswer: "Rotation on its axis",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 6,
      },
      {
        id: "sci-g6-q2",
        text: "What is the order of planets from the Sun?",
        options: [
          "Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune",
          "Mercury, Earth, Venus, Mars, Jupiter, Saturn, Uranus, Neptune",
          "Mercury, Venus, Earth, Jupiter, Mars, Saturn, Uranus, Neptune",
          "Mercury, Venus, Earth, Mars, Saturn, Jupiter, Uranus, Neptune"
        ],
        correctAnswer: "Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune",
        category: "Science",
        difficulty: "hard",
        gradeLevel: 6,
      },
      {
        id: "sci-g6-q3",
        text: "What causes the seasons on Earth?",
        options: ["Distance from the Sun", "Earth's tilt on its axis", "Ocean currents", "Wind patterns"],
        correctAnswer: "Earth's tilt on its axis",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 6,
      },
      {
        id: "sci-g6-q4",
        text: "What are the layers of Earth from outside to inside?",
        options: [
          "Crust, Mantle, Outer Core, Inner Core",
          "Crust, Outer Core, Mantle, Inner Core",
          "Inner Core, Outer Core, Mantle, Crust",
          "Mantle, Crust, Outer Core, Inner Core"
        ],
        correctAnswer: "Crust, Mantle, Outer Core, Inner Core",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 6,
      },
      {
        id: "sci-g6-q5",
        text: "Which planet has the Great Red Spot?",
        options: ["Mars", "Jupiter", "Venus", "Saturn"],
        correctAnswer: "Jupiter",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 6,
      },
    ],
  },
  
  // Grade 7 Quizzes
  {
    id: "english-quiz-g7",
    title: "Grammar & Literature",
    category: "English",
    gradeLevel: 7,
    questions: [
      {
        id: "eng-g7-q1",
        text: "Which of the following is a preposition?",
        options: ["Run", "Quickly", "Under", "Beautiful"],
        correctAnswer: "Under",
        category: "English",
        difficulty: "medium",
        gradeLevel: 7,
      },
      {
        id: "eng-g7-q2",
        text: "Identify the correct sentence:",
        options: [
          "They was going to the store.",
          "She don't like chocolate.",
          "He doesn't have any money.",
          "We is ready to leave."
        ],
        correctAnswer: "He doesn't have any money.",
        category: "English",
        difficulty: "medium",
        gradeLevel: 7,
      },
      {
        id: "eng-g7-q3",
        text: "Which literary device uses 'like' or 'as' to compare things?",
        options: ["Metaphor", "Simile", "Personification", "Hyperbole"],
        correctAnswer: "Simile",
        category: "English",
        difficulty: "medium",
        gradeLevel: 7,
      },
      {
        id: "eng-g7-q4",
        text: "What is the past tense of 'begin'?",
        options: ["Begun", "Beginning", "Began", "Begined"],
        correctAnswer: "Began",
        category: "English",
        difficulty: "medium",
        gradeLevel: 7,
      },
      {
        id: "eng-g7-q5",
        text: "Identify the adjective: 'The red car drove quickly.'",
        options: ["The", "Red", "Drove", "Quickly"],
        correctAnswer: "Red",
        category: "English",
        difficulty: "medium",
        gradeLevel: 7,
      },
    ],
  },
  
  // Grade 8 Quizzes
  {
    id: "science-quiz-g8",
    title: "Chemistry Basics",
    category: "Science",
    gradeLevel: 8,
    questions: [
      {
        id: "sci-g8-q1",
        text: "What is the chemical formula for water?",
        options: ["CO2", "H2O", "O2", "H2O2"],
        correctAnswer: "H2O",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 8,
      },
      {
        id: "sci-g8-q2",
        text: "What is the smallest unit of matter?",
        options: ["Element", "Molecule", "Atom", "Cell"],
        correctAnswer: "Atom",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 8,
      },
      {
        id: "sci-g8-q3",
        text: "What is the pH of a neutral solution?",
        options: ["0", "7", "14", "10"],
        correctAnswer: "7",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 8,
      },
      {
        id: "sci-g8-q4",
        text: "Which element has the symbol 'Fe'?",
        options: ["Fluorine", "Iron", "Francium", "Fermium"],
        correctAnswer: "Iron",
        category: "Science",
        difficulty: "medium",
        gradeLevel: 8,
      },
      {
        id: "sci-g8-q5",
        text: "Which of these is a physical change?",
        options: [
          "Rusting of iron",
          "Burning of paper",
          "Melting of ice",
          "Digesting food"
        ],
        correctAnswer: "Melting of ice",
        category: "Science",
        difficulty: "hard",
        gradeLevel: 8,
      },
    ],
  },
  {
    id: "math-quiz-g8",
    title: "Algebra Fundamentals",
    category: "Math",
    gradeLevel: 8,
    questions: [
      {
        id: "math-g8-q1",
        text: "Solve for x: 3x + 5 = 20",
        options: ["5", "7", "8", "5/3"],
        correctAnswer: "5",
        category: "Math",
        difficulty: "hard",
        gradeLevel: 8,
      },
      {
        id: "math-g8-q2",
        text: "What is the slope of the line y = 2x + 3?",
        options: ["1", "2", "3", "-2"],
        correctAnswer: "2",
        category: "Math",
        difficulty: "hard",
        gradeLevel: 8,
      },
      {
        id: "math-g8-q3",
        text: "Simplify: 2(x + 4) - 3(x - 1)",
        options: ["2x - 5", "2x + 11", "-x + 11", "-x + 5"],
        correctAnswer: "-x + 11",
        category: "Math",
        difficulty: "hard",
        gradeLevel: 8,
      },
      {
        id: "math-g8-q4",
        text: "If y is directly proportional to x, and y = 15 when x = 3, find y when x = 7.",
        options: ["25", "35", "21", "45"],
        correctAnswer: "35",
        category: "Math",
        difficulty: "hard",
        gradeLevel: 8,
      },
      {
        id: "math-g8-q5",
        text: "What is the solution to the inequality 2x - 7 > 5?",
        options: ["x > 6", "x < 6", "x > -1", "x < -1"],
        correctAnswer: "x > 6",
        category: "Math",
        difficulty: "hard",
        gradeLevel: 8,
      },
    ],
  }
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
  
  const createRandomQuiz = (
    category: string, 
    count: number, 
    gradeLevel: number, 
    difficulty?: "easy" | "medium" | "hard"
  ): Quiz | null => {
    // Get all questions that match the criteria
    let allQuestions = quizzes
      .filter(quiz => quiz.category.toLowerCase() === category.toLowerCase())
      .flatMap(quiz => quiz.questions)
      .filter(q => q.gradeLevel === gradeLevel);
    
    // Filter by difficulty if specified
    if (difficulty) {
      const difficultyQuestions = allQuestions.filter(q => q.difficulty === difficulty);
      
      // If we don't have enough questions at the specified difficulty, use all available
      // but prioritize the requested difficulty
      if (difficultyQuestions.length >= count) {
        allQuestions = difficultyQuestions;
      } else {
        // Sort so that requested difficulty comes first
        allQuestions.sort((a, b) => {
          if (a.difficulty === difficulty) return -1;
          if (b.difficulty === difficulty) return 1;
          return 0;
        });
      }
    }
    
    if (allQuestions.length === 0) return null;
    
    // Shuffle and take requested number of questions (or as many as available)
    const randomQuestions = shuffleArray(allQuestions).slice(0, count);
    
    if (randomQuestions.length === 0) return null;
    
    // Create a new randomized quiz
    return {
      id: `random-${category.toLowerCase()}-${Date.now()}`,
      title: `${difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + " " : ""}${category} Quiz`,
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
