
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/context/UserContext";
import { useQuiz } from "@/context/QuizContext";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Book, 
  Users, 
  ChevronLeft, 
  Plus, 
  Edit,
  Trash2, 
  BarChart2,
  FileText, 
  Clipboard,
  Search
} from "lucide-react";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  
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

  // Mock data for teacher dashboard
  const mockStudents = [
    { id: "s1", name: "Abebe Kebede", grade: "6", averageScore: 85, quizzesTaken: 12, lastActive: "2 hours ago" },
    { id: "s2", name: "Tigist Alemu", grade: "6", averageScore: 92, quizzesTaken: 15, lastActive: "1 day ago" },
    { id: "s3", name: "Dawit Haile", grade: "5", averageScore: 78, quizzesTaken: 8, lastActive: "3 hours ago" },
    { id: "s4", name: "Feven Tadesse", grade: "7", averageScore: 88, quizzesTaken: 10, lastActive: "5 hours ago" },
    { id: "s5", name: "Solomon Girma", grade: "5", averageScore: 90, quizzesTaken: 14, lastActive: "yesterday" },
    { id: "s6", name: "Hanna Mekonnen", grade: "6", averageScore: 82, quizzesTaken: 9, lastActive: "4 days ago" },
  ];

  const mockQuestions = [
    { id: "q1", text: "What is 5 + 7?", category: "Math", grade: 5, difficulty: "easy" },
    { id: "q2", text: "What planet is closest to the sun?", category: "Science", grade: 5, difficulty: "medium" },
    { id: "q3", text: "What is the past tense of run?", category: "English", grade: 5, difficulty: "easy" },
    { id: "q4", text: "What is the capital of Ethiopia?", category: "General Knowledge", grade: 6, difficulty: "medium" },
    { id: "q5", text: "What is 8 × 4?", category: "Math", grade: 5, difficulty: "easy" },
  ];

  const filteredStudents = searchTerm 
    ? mockStudents.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        student.grade.includes(searchTerm)
      )
    : mockStudents;

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              Question Bank
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Students
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="create" className="mt-4 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Question Bank</h2>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Filter Questions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <Select defaultValue="all">
                        <SelectTrigger>
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="Math">Math</SelectItem>
                          <SelectItem value="Science">Science</SelectItem>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="General Knowledge">General Knowledge</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Grade Level</label>
                      <Select defaultValue="all">
                        <SelectTrigger>
                          <SelectValue placeholder="All Grades" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Grades</SelectItem>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(grade => (
                            <SelectItem key={grade} value={grade.toString()}>
                              Grade {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Difficulty</label>
                      <Select defaultValue="all">
                        <SelectTrigger>
                          <SelectValue placeholder="All Difficulties" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Difficulties</SelectItem>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button className="w-full">Apply Filters</Button>
                  </CardContent>
                </Card>
                
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Question Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Questions:</span>
                        <span className="font-medium">{mockQuestions.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Math Questions:</span>
                        <span className="font-medium">
                          {mockQuestions.filter(q => q.category === "Math").length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Science Questions:</span>
                        <span className="font-medium">
                          {mockQuestions.filter(q => q.category === "Science").length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Easy Questions:</span>
                        <span className="font-medium">
                          {mockQuestions.filter(q => q.difficulty === "easy").length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="md:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Question List</CardTitle>
                    <div className="w-full pt-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input 
                          placeholder="Search questions..." 
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="space-y-1">
                      {mockQuestions.map(question => (
                        <div key={question.id} className="border-b p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{question.text}</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <Badge variant="outline">{question.category}</Badge>
                                <Badge variant="outline">Grade {question.grade}</Badge>
                                <Badge className={
                                  question.difficulty === "easy" ? "bg-green-500" :
                                  question.difficulty === "medium" ? "bg-yellow-500" : "bg-red-500"
                                }>
                                  {question.difficulty}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="mt-4">
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
                    
                    <div className="grid grid-cols-3 gap-4">
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
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="students" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>My Students</CardTitle>
                    <div className="relative pt-2">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                        placeholder="Search students..." 
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                    <div className="space-y-1">
                      {filteredStudents.map((student) => (
                        <div 
                          key={student.id} 
                          className={`border-b p-3 hover:bg-gray-50 cursor-pointer ${
                            selectedStudent === student.id ? 'bg-primary-light' : ''
                          }`}
                          onClick={() => setSelectedStudent(student.id)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{student.name}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>Grade {student.grade}</span>
                                <span>•</span>
                                <span>{student.averageScore}%</span>
                              </div>
                            </div>
                            <Badge variant="outline">
                              {student.quizzesTaken} quizzes
                            </Badge>
                          </div>
                        </div>
                      ))}
                      
                      {filteredStudents.length === 0 && (
                        <div className="p-4 text-center text-gray-500">
                          No students found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Class Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total Students:</span>
                        <span className="font-medium">{mockStudents.length}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Average Score:</span>
                        <span className="font-medium">
                          {Math.round(
                            mockStudents.reduce((sum, s) => sum + s.averageScore, 0) / 
                            mockStudents.length
                          )}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total Quizzes Taken:</span>
                        <span className="font-medium">
                          {mockStudents.reduce((sum, s) => sum + s.quizzesTaken, 0)}
                        </span>
                      </div>
                      
                      <Button variant="outline" className="w-full mt-2">
                        <FileText className="h-4 w-4 mr-2" />
                        Export Class Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="md:col-span-2">
                <Card>
                  {selectedStudent ? (
                    <>
                      <CardHeader>
                        <div className="flex justify-between">
                          <div>
                            <CardTitle>
                              {mockStudents.find(s => s.id === selectedStudent)?.name}
                            </CardTitle>
                            <CardDescription>
                              Grade {mockStudents.find(s => s.id === selectedStudent)?.grade} • 
                              Last active {mockStudents.find(s => s.id === selectedStudent)?.lastActive}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4 mr-1" /> 
                              Student Report
                            </Button>
                            <Button size="sm">
                              <Clipboard className="h-4 w-4 mr-1" />
                              Send Feedback
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Student Performance Summary */}
                          <div className="grid grid-cols-3 gap-4">
                            <Card>
                              <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-primary">
                                  {mockStudents.find(s => s.id === selectedStudent)?.averageScore}%
                                </div>
                                <p className="text-sm text-gray-500">Average Score</p>
                              </CardContent>
                            </Card>
                            
                            <Card>
                              <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-primary">
                                  {mockStudents.find(s => s.id === selectedStudent)?.quizzesTaken}
                                </div>
                                <p className="text-sm text-gray-500">Quizzes Taken</p>
                              </CardContent>
                            </Card>
                            
                            <Card>
                              <CardContent className="p-4 text-center">
                                <div className="text-3xl font-bold text-primary">
                                  4
                                </div>
                                <p className="text-sm text-gray-500">Subject Areas</p>
                              </CardContent>
                            </Card>
                          </div>
                          
                          {/* Subject Performance */}
                          <div>
                            <h3 className="text-lg font-medium mb-2">Subject Performance</h3>
                            {/* Sample subject data - in a real app this would be dynamic */}
                            <div className="space-y-3">
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium">Math</span>
                                  <span className="text-sm font-medium">92%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '92%' }}></div>
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium">Science</span>
                                  <span className="text-sm font-medium">85%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '85%' }}></div>
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium">English</span>
                                  <span className="text-sm font-medium">78%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: '78%' }}></div>
                                </div>
                              </div>
                              
                              <div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium">General Knowledge</span>
                                  <span className="text-sm font-medium">80%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: '80%' }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Recent Quizzes */}
                          <div>
                            <h3 className="text-lg font-medium mb-2">Recent Quiz Activity</h3>
                            <div className="border rounded-lg divide-y">
                              <div className="p-3 flex justify-between">
                                <div>
                                  <div className="font-medium">Basic Mathematics</div>
                                  <div className="text-sm text-gray-500">Math • 10 questions</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-green-600">90%</div>
                                  <div className="text-xs text-gray-500">Yesterday</div>
                                </div>
                              </div>
                              
                              <div className="p-3 flex justify-between">
                                <div>
                                  <div className="font-medium">Basic Science</div>
                                  <div className="text-sm text-gray-500">Science • 8 questions</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-green-600">85%</div>
                                  <div className="text-xs text-gray-500">2 days ago</div>
                                </div>
                              </div>
                              
                              <div className="p-3 flex justify-between">
                                <div>
                                  <div className="font-medium">English Grammar</div>
                                  <div className="text-sm text-gray-500">English • 12 questions</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-yellow-600">75%</div>
                                  <div className="text-xs text-gray-500">3 days ago</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </>
                  ) : (
                    <div className="p-10 text-center">
                      <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-xl font-medium text-gray-600 mb-1">
                        Select a student
                      </h3>
                      <p className="text-gray-500">
                        Choose a student from the list to view their detailed progress
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="reports" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Class Reports</CardTitle>
                <CardDescription>View and analyze class performance data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-medium mb-4">Quiz Completion Rate</h3>
                        <div className="flex items-center justify-center">
                          <div className="relative h-32 w-32">
                            {/* Circular progress indicator */}
                            <div className="absolute inset-0 rounded-full border-8 border-gray-200"></div>
                            <div 
                              className="absolute inset-0 rounded-full border-8 border-primary" 
                              style={{ 
                                clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 50% 100%, 50% 50%)',
                                transform: 'rotate(45deg)'
                              }}
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-2xl font-bold">75%</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-medium mb-4">Average Class Score</h3>
                        <div className="flex items-center justify-center">
                          <span className="text-5xl font-bold text-primary">82%</span>
                        </div>
                        <div className="mt-4 text-center text-sm text-gray-500">
                          +5% from last month
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-medium mb-4">Total Quizzes Assigned</h3>
                        <div className="flex items-center justify-center">
                          <span className="text-5xl font-bold text-primary">24</span>
                        </div>
                        <div className="mt-4 text-center text-sm text-gray-500">
                          12 active, 12 completed
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance by Subject</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">Math</span>
                            <span className="text-sm font-medium">85%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '85%' }}></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">Science</span>
                            <span className="text-sm font-medium">78%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '78%' }}></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">English</span>
                            <span className="text-sm font-medium">92%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: '92%' }}></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">General Knowledge</span>
                            <span className="text-sm font-medium">70%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: '70%' }}></div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-end gap-3">
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Export Reports
                    </Button>
                    <Button>
                      Generate New Report
                    </Button>
                  </div>
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
