
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
    {
      id: createQuestionId("Math", 5, 4),
      text: "If you have 3 quarters, 4 dimes, and 2 nickels, how much money do you have in total?",
      options: ["$0.95", "$1.15", "$1.25", "$1.35"],
      correctAnswer: "$1.35",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 5,
      topic: "Money",
      type: "Multiple Choice",
      points: 10,
      explanation: "3 quarters = $0.75, 4 dimes = $0.40, 2 nickels = $0.10. Total = $0.75 + $0.40 + $0.10 = $1.35"
    },
    {
      id: createQuestionId("Math", 5, 5),
      text: "What is 3/5 of 25?",
      options: ["12", "15", "18", "20"],
      correctAnswer: "15",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 5,
      topic: "Fractions",
      type: "Multiple Choice",
      points: 10,
      explanation: "To find 3/5 of 25, multiply 25 by 3/5: 25 × (3/5) = (25 × 3) ÷ 5 = 75 ÷ 5 = 15"
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
    {
      id: createQuestionId("Science", 5, 3),
      text: "Plants make their food through which process?",
      options: ["Respiration", "Photosynthesis", "Digestion", "Fermentation"],
      correctAnswer: "Photosynthesis",
      difficulty: "Easy",
      subject: "Science",
      grade: 5,
      topic: "Plants",
      type: "Multiple Choice",
      points: 5,
      explanation: "Plants make their own food through photosynthesis, using sunlight, carbon dioxide, and water to produce glucose and oxygen."
    },
    {
      id: createQuestionId("Science", 5, 4),
      text: "Which planet is known as the 'Red Planet'?",
      options: ["Venus", "Mars", "Jupiter", "Mercury"],
      correctAnswer: "Mars",
      difficulty: "Easy",
      subject: "Science",
      grade: 5,
      topic: "Solar System",
      type: "Multiple Choice",
      points: 5,
      explanation: "Mars appears reddish because of iron oxide (rust) on its surface, earning it the nickname 'Red Planet'."
    },
    {
      id: createQuestionId("Science", 5, 5),
      text: "Which force pulls objects toward the center of the Earth?",
      options: ["Friction", "Magnetism", "Gravity", "Tension"],
      correctAnswer: "Gravity",
      difficulty: "Easy",
      subject: "Science",
      grade: 5,
      topic: "Forces",
      type: "Multiple Choice",
      points: 5,
      explanation: "Gravity is the force that attracts objects toward the center of the Earth or toward any other physical body having mass."
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
    {
      id: createQuestionId("English", 5, 2),
      text: "Which word is a synonym for 'happy'?",
      options: ["Sad", "Joyful", "Angry", "Tired"],
      correctAnswer: "Joyful",
      difficulty: "Easy",
      subject: "English",
      grade: 5,
      topic: "Vocabulary",
      type: "Multiple Choice",
      points: 5,
      explanation: "A synonym is a word that means the same as another word. 'Joyful' means the same as 'happy'."
    },
    {
      id: createQuestionId("English", 5, 3),
      text: "Which of these is a proper noun?",
      options: ["City", "Paris", "Building", "River"],
      correctAnswer: "Paris",
      difficulty: "Easy",
      subject: "English",
      grade: 5,
      topic: "Grammar",
      type: "Multiple Choice",
      points: 5,
      explanation: "A proper noun names a specific person, place, or thing. 'Paris' is a specific city, making it a proper noun."
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
    {
      id: createQuestionId("Math", 6, 3),
      text: "What is the value of x in the equation 2x + 5 = 15?",
      options: ["5", "7", "8", "10"],
      correctAnswer: "5",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 6,
      topic: "Algebra",
      type: "Multiple Choice",
      points: 10,
      explanation: "2x + 5 = 15\n2x = 15 - 5\n2x = 10\nx = 10 ÷ 2\nx = 5"
    },
    {
      id: createQuestionId("Math", 6, 4),
      text: "What is the greatest common factor (GCF) of 18 and 24?",
      options: ["3", "6", "9", "12"],
      correctAnswer: "6",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 6,
      topic: "Factors",
      type: "Multiple Choice",
      points: 10,
      explanation: "The factors of 18 are 1, 2, 3, 6, 9, 18. The factors of 24 are 1, 2, 3, 4, 6, 8, 12, 24. The largest factor that appears in both lists is 6."
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
    {
      id: createQuestionId("Science", 6, 2),
      text: "Which layer of Earth's atmosphere contains the ozone layer?",
      options: ["Troposphere", "Stratosphere", "Mesosphere", "Thermosphere"],
      correctAnswer: "Stratosphere",
      difficulty: "Medium",
      subject: "Science",
      grade: 6,
      topic: "Earth Science",
      type: "Multiple Choice",
      points: 10,
      explanation: "The ozone layer is located in the stratosphere, which is the second layer of Earth's atmosphere."
    },
    {
      id: createQuestionId("Science", 6, 3),
      text: "Which organelle is known as the 'powerhouse of the cell'?",
      options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi Apparatus"],
      correctAnswer: "Mitochondria",
      difficulty: "Easy",
      subject: "Science",
      grade: 6,
      topic: "Cells",
      type: "Multiple Choice",
      points: 5,
      explanation: "Mitochondria are responsible for cellular respiration, producing energy for the cell in the form of ATP."
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
    {
      id: createQuestionId("English", 6, 2),
      text: "What is the past tense of the verb 'speak'?",
      options: ["Speaking", "Spoke", "Speaks", "Speaked"],
      correctAnswer: "Spoke",
      difficulty: "Easy",
      subject: "English",
      grade: 6,
      topic: "Grammar",
      type: "Multiple Choice",
      points: 5,
      explanation: "'Spoke' is the past tense of the irregular verb 'speak'."
    },
    {
      id: createQuestionId("English", 6, 3),
      text: "Which literary device is used in the phrase 'as cold as ice'?",
      options: ["Metaphor", "Simile", "Personification", "Alliteration"],
      correctAnswer: "Simile",
      difficulty: "Medium",
      subject: "English",
      grade: 6,
      topic: "Literary Devices",
      type: "Multiple Choice",
      points: 10,
      explanation: "A simile is a comparison using 'like' or 'as'. The phrase 'as cold as ice' uses 'as' to compare something's temperature to ice, making it a simile."
    },
    
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
    {
      id: createQuestionId("Math", 7, 2),
      text: "What is the circumference of a circle with a radius of 7 cm? (Use π = 3.14)",
      options: ["13.98 cm", "21.98 cm", "43.96 cm", "153.86 cm"],
      correctAnswer: "43.96 cm",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 7,
      topic: "Geometry",
      type: "Multiple Choice",
      points: 10,
      explanation: "The formula for the circumference of a circle is C = 2πr, where r is the radius. C = 2 × 3.14 × 7 = 43.96 cm"
    },
    {
      id: createQuestionId("Math", 7, 3),
      text: "What is the value of the expression 3(2x - 4) + 5 when x = 3?",
      options: ["5", "8", "11", "14"],
      correctAnswer: "11",
      difficulty: "Medium",
      subject: "Mathematics",
      grade: 7,
      topic: "Algebra",
      type: "Multiple Choice",
      points: 10,
      explanation: "3(2x - 4) + 5 = 3(2(3) - 4) + 5 = 3(6 - 4) + 5 = 3(2) + 5 = 6 + 5 = 11"
    },
    
    // Grade 7 Science
    {
      id: createQuestionId("Science", 7, 1),
      text: "Which of the following is NOT one of the phases of mitosis?",
      options: ["Prophase", "Metaphase", "Synthesis", "Telophase"],
      correctAnswer: "Synthesis",
      difficulty: "Hard",
      subject: "Science",
      grade: 7,
      topic: "Biology",
      type: "Multiple Choice",
      points: 15,
      explanation: "The four phases of mitosis are prophase, metaphase, anaphase, and telophase. Synthesis (or S phase) is part of interphase, which occurs before mitosis."
    },
    {
      id: createQuestionId("Science", 7, 2),
      text: "Which of these elements is a noble gas?",
      options: ["Sodium", "Chlorine", "Neon", "Calcium"],
      correctAnswer: "Neon",
      difficulty: "Medium",
      subject: "Science",
      grade: 7,
      topic: "Chemistry",
      type: "Multiple Choice",
      points: 10,
      explanation: "Noble gases are the elements in the rightmost column of the periodic table. Neon (Ne) is a noble gas, while sodium (Na), chlorine (Cl), and calcium (Ca) are not."
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
    },
    {
      id: createQuestionId("Science", 8, 2),
      text: "What is the pH of a neutral solution?",
      options: ["0", "7", "10", "14"],
      correctAnswer: "7",
      difficulty: "Easy",
      subject: "Science",
      grade: 8,
      topic: "Chemistry",
      type: "Multiple Choice",
      points: 5,
      explanation: "The pH scale ranges from 0 to 14. A neutral solution (neither acidic nor basic) has a pH of exactly 7."
    },
    {
      id: createQuestionId("Science", 8, 3),
      text: "Which of the following is NOT a type of chemical bond?",
      options: ["Ionic bond", "Covalent bond", "Magnetic bond", "Hydrogen bond"],
      correctAnswer: "Magnetic bond",
      difficulty: "Medium",
      subject: "Science",
      grade: 8,
      topic: "Chemistry",
      type: "Multiple Choice",
      points: 10,
      explanation: "Ionic, covalent, and hydrogen bonds are all types of chemical bonds. A 'magnetic bond' is not a recognized type of chemical bond."
    },
    
    // Grade 8 Math
    {
      id: createQuestionId("Math", 8, 1),
      text: "Solve the system of equations: x + y = 5 and 2x - y = 4",
      options: ["x = 3, y = 2", "x = 4, y = 1", "x = 2, y = 3", "x = 1, y = 4"],
      correctAnswer: "x = 3, y = 2",
      difficulty: "Hard",
      subject: "Mathematics",
      grade: 8,
      topic: "Algebra",
      type: "Multiple Choice",
      points: 15,
      explanation: "From the first equation: y = 5 - x. Substitute this into the second equation:\n2x - (5 - x) = 4\n2x - 5 + x = 4\n3x - 5 = 4\n3x = 9\nx = 3\nSo y = 5 - 3 = 2. The solution is x = 3, y = 2."
    }
  ];
  
  // Add many more questions here
  
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
      title: "Math Challenge - Grade 7",
      description: "Challenge your math skills with advanced problems",
      questions: filterQuestions("Mathematics", 7, "Medium", "Algebra").concat(
        filterQuestions("Mathematics", 7, "Hard", "Geometry")
      ),
      subject: "Mathematics",
      grade: 7,
      difficulty: "Hard",
      timeLimit: 360,
      createdAt: new Date(),
      topics: ["Algebra", "Geometry"],
      category: "Mathematics",
      gradeLevel: 7
    },
    {
      id: generateQuizId(),
      title: "Science Exploration - Grade 8",
      description: "Explore advanced science topics for Grade 8 students",
      questions: filterQuestions("Science", 8, "Medium", "Chemistry").concat(
        filterQuestions("Science", 8, "Hard", "Physics")
      ),
      subject: "Science",
      grade: 8,
      difficulty: "Medium",
      timeLimit: 300,
      createdAt: new Date(),
      topics: ["Chemistry", "Physics"],
      category: "Science",
      gradeLevel: 8
    },
    {
      id: generateQuizId(),
      title: "English Literature - Grade 7",
      description: "Test your knowledge of literary devices and grammar",
      questions: filterQuestions("English", 6, "Medium", "Literary Devices"),
      subject: "English",
      grade: 7,
      difficulty: "Medium",
      timeLimit: 300,
      createdAt: new Date(),
      topics: ["Literary Devices", "Grammar"],
      category: "English",
      gradeLevel: 7
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
    },
    {
      id: generateQuizId(),
      title: "Advanced Math - Grade 8",
      description: "Challenge yourself with advanced math concepts",
      questions: filterQuestions("Mathematics", 8, "Hard", "Algebra"),
      subject: "Mathematics",
      grade: 8,
      difficulty: "Hard",
      timeLimit: 360,
      createdAt: new Date(),
      topics: ["Algebra"],
      category: "Mathematics",
      gradeLevel: 8
    }
  ];
};

// This function will be used in the QuizContext to initialize with real data
export const initializeRealQuizData = (): Quiz[] => {
  return generateRealQuizzes();
};
