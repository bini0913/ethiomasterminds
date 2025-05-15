
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/context/UserContext";
import { useQuiz } from "@/context/QuizContext";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Book, Users, ChevronLeft } from "lucide-react";

const TeacherDashboard: React.FC = () => {
  const { user } = useUser();
  const { quizzes } = useQuiz();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("create");
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [category, setCategory] = useState("Math");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [gradeLevel, setGradeLevel] = useState<number>(5);
  
  // Redirect if not a teacher
  React.useEffect(() => {
    if (user && user.role !== "teacher") {
      toast.error("You don't have permission to access this page");
      navigate("/");
    }
  }, [user, navigate]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreateQuestion = () => {
    if (!questionText || options.some(opt => !opt) || !correctAnswer || !category) {
      toast.error("Please fill in all fields");
      return;
    }
    
    if (!options.includes(correctAnswer)) {
      toast.error("Correct answer must be one of the options");
      return;
    }
    
    // In a real app, this would save to a database
    toast.success("Question created successfully!");
    
    // Reset form
    setQuestionText("");
    setOptions(["", "", "", ""]);
    setCorrectAnswer("");
  };

  const mockStudents = [
    { id: "s1", name: "Abebe Kebede", grade: "6", averageScore: 85 },
    { id: "s2", name: "Tigist Alemu", grade: "6", averageScore: 92 },
    { id: "s3", name: "Dawit Haile", grade: "5", averageScore: 78 },
    { id: "s4", name: "Feven Tadesse", grade: "7", averageScore: 88 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary px-4 py-3 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
              className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-white">Teacher Dashboard</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Create Questions
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Student Progress
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="create" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create New Question</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Question Text</label>
                  <Textarea 
                    placeholder="Enter your question here..."
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Options</label>
                  {options.map((option, index) => (
                    <Input
                      key={index}
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="mb-2"
                    />
                  ))}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Correct Answer</label>
                  <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select correct answer" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option, index) => (
                        option ? (
                          <SelectItem key={index} value={option}>
                            {option}
                          </SelectItem>
                        ) : null
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Math">Math</SelectItem>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="General Knowledge">General Knowledge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Difficulty</label>
                    <Select 
                      value={difficulty} 
                      onValueChange={(value) => setDifficulty(value as "easy" | "medium" | "hard")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Grade Level</label>
                    <Select 
                      value={gradeLevel.toString()} 
                      onValueChange={(value) => setGradeLevel(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((grade) => (
                          <SelectItem key={grade} value={grade.toString()}>
                            Grade {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button 
                  className="w-full mt-4" 
                  onClick={handleCreateQuestion}
                >
                  Create Question
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="students" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Student Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockStudents.map((student) => (
                    <div 
                      key={student.id} 
                      className="flex justify-between items-center border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div>
                        <h3 className="font-medium">{student.name}</h3>
                        <p className="text-sm text-gray-500">Grade {student.grade}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="block font-semibold">{student.averageScore}%</span>
                          <span className="text-sm text-gray-500">Average Score</span>
                        </div>
                        <Button size="sm" variant="outline">View Details</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TeacherDashboard;
