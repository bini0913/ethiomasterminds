
import { Question, Quiz } from "@/context/QuizContext";

// Helper function to create question IDs
const createQuestionId = (subject: string, grade: number, index: number): string => {
  return `${subject.toLowerCase()}-g${grade}-q${index}`;
};

// Create a database of real questions
export const generateRealQuestionDatabase = (): Question[] => {
  const questions: Question[] = [
    // Math Questions - Grade 5
    {
      id: createQuestionId("Math", 5, 1),
      text: "What is the value of 8 × 7?",
      options: ["54", "56", "64", "72"],
      correctAnswer: "56",
      difficulty: "Easy",
      subject: "Mathematics",
      grade: 5,
      topic: "Multiplication",
      type: "Multiple Choice",
      points: 5,
      explanation: "To find the product of 8 × 7, multiply 8 by 7. The result is 56."
    },
    {
      id: createQuestionId("Math", 5, 2),
      text: "What is the perimeter of a rectangle with length 8 cm and width 5 cm?",
      options: ["13 cm", "26 cm", "40 cm", "30 cm"],
      correctAnswer: "26 cm",
      difficulty: "Easy",
      subject: "Mathematics",
      grade: 5,
      topic: "Geometry",
      type: "Multiple Choice",
      points: 5,
      explanation: "The perimeter of a rectangle is calculated using the formula: P = 2(l + w). Substituting, P = 2(8 + 5) = 2(13) = 26 cm."
    },
    {
      id: createQuestionId("Math", 5, 3),
      text: "What is the sum of the angles in a triangle?",
      options: ["90°", "180°", "270°", "360°"],
      correctAnswer: "180°",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 5,
      topic: "Geometry",
      type: "Multiple Choice",
      points: 10,
      explanation: "The sum of the angles in a triangle is always 180 degrees."
    },
    
    // Science Questions - Grade 5
    {
      id: createQuestionId("Science", 5, 1),
      text: "Which of the following is NOT a state of matter?",
      options: ["Solid", "Liquid", "Gas", "Energy"],
      correctAnswer: "Energy",
      difficulty: "Medium",
      subject: "Science",
      grade: 5,
      topic: "States of Matter",
      type: "Multiple Choice",
      points: 10,
      explanation: "The three common states of matter are solid, liquid, and gas. Energy is a form of power, not a state of matter."
    },
    {
      id: createQuestionId("Science", 5, 2),
      text: "Which organ is responsible for pumping blood throughout the body?",
      options: ["Lungs", "Brain", "Heart", "Liver"],
      correctAnswer: "Heart",
      difficulty: "Easy",
      subject: "Science",
      grade: 5,
      topic: "Human Body",
      type: "Multiple Choice",
      points: 5,
      explanation: "The heart is a muscular organ that pumps blood throughout the body via the circulatory system."
    },
    
    // English Questions - Grade 5
    {
      id: createQuestionId("English", 5, 1),
      text: "In the sentence 'She ran quickly to catch the bus', what is the adverb?",
      options: ["She", "ran", "quickly", "bus"],
      correctAnswer: "quickly",
      difficulty: "Medium",
      subject: "English",
      grade: 5,
      topic: "Grammar",
      type: "Multiple Choice",
      points: 10,
      explanation: "Adverbs modify verbs, adjectives, or other adverbs. In this sentence, 'quickly' describes how she ran, making it an adverb."
    },
    
    // Math Questions - Grade 6
    {
      id: createQuestionId("Math", 6, 1),
      text: "What is the value of 3² + 4²?",
      options: ["7", "24", "25", "49"],
      correctAnswer: "25",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 6,
      topic: "Exponents",
      type: "Multiple Choice",
      points: 10,
      explanation: "3² = 9 and 4² = 16. The sum is 9 + 16 = 25."
    },
    {
      id: createQuestionId("Math", 6, 2),
      text: "If a rectangle has an area of 48 square meters and a width of 6 meters, what is its length?",
      options: ["6 meters", "8 meters", "12 meters", "24 meters"],
      correctAnswer: "8 meters",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 6,
      topic: "Area",
      type: "Multiple Choice",
      points: 10,
      explanation: "The formula for the area of a rectangle is A = l × w. If A = 48 and w = 6, then l = A ÷ w = 48 ÷ 6 = 8 meters."
    },
    
    // Science Questions - Grade 6
    {
      id: createQuestionId("Science", 6, 1),
      text: "Which of the following is NOT a renewable resource?",
      options: ["Solar energy", "Wind energy", "Coal", "Hydropower"],
      correctAnswer: "Coal",
      difficulty: "Medium",
      subject: "Science",
      grade: 6,
      topic: "Natural Resources",
      type: "Multiple Choice",
      points: 10,
      explanation: "Coal is a fossil fuel that takes millions of years to form and is not renewable within human timescales."
    },
    
    // English Questions - Grade 6
    {
      id: createQuestionId("English", 6, 1),
      text: "Which of the following is a proper noun?",
      options: ["city", "Ethiopia", "mountain", "river"],
      correctAnswer: "Ethiopia",
      difficulty: "Easy",
      subject: "English",
      grade: 6,
      topic: "Grammar",
      type: "Multiple Choice",
      points: 5,
      explanation: "A proper noun is the name of a specific person, place, or thing. Ethiopia is a specific country name, making it a proper noun."
    },
    
    // Add more questions for different grades (7-12)...
    // Grade 7 Math
    {
      id: createQuestionId("Math", 7, 1),
      text: "Solve for x: 2x - 5 = 15",
      options: ["5", "10", "15", "20"],
      correctAnswer: "10",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 7,
      topic: "Algebra",
      type: "Multiple Choice",
      points: 10,
      explanation: "2x - 5 = 15\n2x = 15 + 5\n2x = 20\nx = 10"
    },
    
    // Grade 8 Science
    {
      id: createQuestionId("Science", 8, 1),
      text: "Which of the following is NOT one of Newton's Laws of Motion?",
      options: [
        "An object at rest stays at rest unless acted upon by a force",
        "Force equals mass times acceleration",
        "Energy can neither be created nor destroyed",
        "For every action, there is an equal and opposite reaction"
      ],
      correctAnswer: "Energy can neither be created nor destroyed",
      difficulty: "Hard",
      subject: "Science",
      grade: 8,
      topic: "Physics",
      type: "Multiple Choice",
      points: 15,
      explanation: "The statement 'Energy can neither be created nor destroyed' is the Law of Conservation of Energy, not one of Newton's Laws of Motion."
    }
  ];
  
  // Add more questions here as needed
  
  return questions;
};

// Create real quizzes based on our questions
export const generateRealQuizzes = (): Quiz[] => {
  const allQuestions = generateRealQuestionDatabase();
  
  // Helper to filter questions by criteria
  const filterQuestions = (subject: string, grade: number, difficulty: "Easy" | "Medium" | "Hard", topic?: string) => {
    return allQuestions.filter(q => 
      q.subject === subject && 
      q.grade === grade && 
      q.difficulty === difficulty &&
      (topic ? q.topic === topic : true)
    );
  };
  
  // Generate quiz id
  const generateQuizId = () => `quiz-${Math.random().toString(36).substring(2, 9)}`;
  
  return [
    {
      id: generateQuizId(),
      title: "Math Basics - Grade 5",
      description: "Test your basic math skills with this quiz for Grade 5 students",
      questions: filterQuestions("Mathematics", 5, "Easy", "Multiplication").concat(
        filterQuestions("Mathematics", 5, "Easy", "Geometry")
      ),
      subject: "Mathematics",
      grade: 5,
      difficulty: "Easy",
      timeLimit: 300,
      createdAt: new Date(),
      topics: ["Multiplication", "Geometry"],
      category: "Mathematics",
      gradeLevel: 5
    },
    {
      id: generateQuizId(),
      title: "Science Fundamentals - Grade 5",
      description: "Explore basic science concepts for Grade 5 students",
      questions: filterQuestions("Science", 5, "Easy", "Human Body").concat(
        filterQuestions("Science", 5, "Medium", "States of Matter")
      ),
      subject: "Science",
      grade: 5,
      difficulty: "Medium",
      timeLimit: 300,
      createdAt: new Date(),
      topics: ["Human Body", "States of Matter"],
      category: "Science",
      gradeLevel: 5
    },
    {
      id: generateQuizId(),
      title: "English Grammar - Grade 6",
      description: "Test your grammar knowledge with this quiz for Grade 6 students",
      questions: filterQuestions("English", 6, "Easy", "Grammar"),
      subject: "English",
      grade: 6,
      difficulty: "Easy",
      timeLimit: 240,
      createdAt: new Date(),
      topics: ["Grammar"],
      category: "English",
      gradeLevel: 6
    },
    {
      id: generateQuizId(),
      title: "Algebra Basics - Grade 7",
      description: "Introduction to basic algebraic concepts for Grade 7",
      questions: filterQuestions("Mathematics", 7, "Medium", "Algebra"),
      subject: "Mathematics",
      grade: 7,
      difficulty: "Medium",
      timeLimit: 300,
      createdAt: new Date(),
      topics: ["Algebra"],
      category: "Mathematics",
      gradeLevel: 7
    }
    // Add more quizzes as needed
  ];
};

// This function will be used in the QuizContext to initialize with real data
export const initializeRealQuizData = (): Quiz[] => {
  return generateRealQuizzes();
};
