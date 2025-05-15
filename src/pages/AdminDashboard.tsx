
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, UserCheck, Settings, BookCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { avatarToEmoji } from "@/utils/avatarUtils";

const AdminDashboard: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("users");
  
  // Redirect if not an admin
  React.useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("You don't have permission to access this page");
      navigate("/");
    }
  }, [user, navigate]);

  const mockUsers = [
    { id: "u1", name: "Sara Tadesse", role: "student", grade: "6", status: "active", avatar: "avatar-1" },
    { id: "u2", name: "Daniel Mekonnen", role: "teacher", grade: null, status: "active", avatar: "avatar-2" },
    { id: "u3", name: "Kidist Haile", role: "student", grade: "8", status: "inactive", avatar: "avatar-3" },
    { id: "u4", name: "Yonas Abebe", role: "student", grade: "7", status: "active", avatar: "avatar-4" },
    { id: "u5", name: "Martha Gebre", role: "teacher", grade: null, status: "active", avatar: "avatar-5" },
  ];

  const mockQuestions = [
    { 
      id: "q1", 
      text: "What is the capital of Ethiopia?", 
      category: "General Knowledge",
      approved: true, 
      createdBy: "Daniel Mekonnen"
    },
    { 
      id: "q2", 
      text: "Solve for x: 3x + 5 = 14", 
      category: "Math",
      approved: true, 
      createdBy: "Martha Gebre"
    },
    { 
      id: "q3", 
      text: "What is the chemical formula for water?", 
      category: "Science",
      approved: false, 
      createdBy: "Daniel Mekonnen"
    },
    { 
      id: "q4", 
      text: "How many planets are in our solar system?", 
      category: "Science",
      approved: false, 
      createdBy: "Martha Gebre"
    },
  ];

  const appStats = {
    totalUsers: 156,
    activeToday: 68,
    questionsAnswered: 1245,
    quizCompletion: 78,
    categoryDistribution: {
      Math: 35,
      Science: 25,
      English: 20,
      "General Knowledge": 20
    }
  };

  const handleToggleApproval = (questionId: string) => {
    // In a real app, this would update the database
    toast.success("Question status updated!");
  };

  const handleToggleUserStatus = (userId: string) => {
    // In a real app, this would update the database
    toast.success("User status updated!");
  };

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
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-6 px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <BookCheck className="h-4 w-4" />
              Content Moderation
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              App Statistics
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockUsers.map((user) => (
                    <div 
                      key={user.id} 
                      className="flex justify-between items-center border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{avatarToEmoji(user.avatar)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{user.name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant={user.role === "teacher" ? "outline" : "secondary"} className="capitalize">
                              {user.role}
                            </Badge>
                            {user.grade && (
                              <span className="text-xs text-gray-500">Grade {user.grade}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={user.status === "active" ? "success" : "destructive"}>
                          {user.status}
                        </Badge>
                        <Button size="sm" onClick={() => handleToggleUserStatus(user.id)}>
                          {user.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="content" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Content Moderation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockQuestions.map((question) => (
                    <div 
                      key={question.id} 
                      className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex justify-between">
                        <Badge variant="outline">{question.category}</Badge>
                        <Badge variant={question.approved ? "success" : "secondary"}>
                          {question.approved ? "Approved" : "Pending"}
                        </Badge>
                      </div>
                      <h3 className="font-medium mt-2">{question.text}</h3>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-xs text-gray-500">Created by: {question.createdBy}</span>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleToggleApproval(question.id)}>
                            {question.approved ? "Unapprove" : "Approve"}
                          </Button>
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive">
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="stats" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>User Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Users</span>
                    <span className="font-bold text-lg">{appStats.totalUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Active Users Today</span>
                    <span className="font-bold text-lg">{appStats.activeToday}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span>User Engagement</span>
                      <span className="font-bold">{Math.round(appStats.activeToday / appStats.totalUsers * 100)}%</span>
                    </div>
                    <Progress value={Math.round(appStats.activeToday / appStats.totalUsers * 100)} />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Questions Answered</span>
                    <span className="font-bold text-lg">{appStats.questionsAnswered}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span>Quiz Completion Rate</span>
                      <span className="font-bold">{appStats.quizCompletion}%</span>
                    </div>
                    <Progress value={appStats.quizCompletion} />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Category Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(appStats.categoryDistribution).map(([category, percentage]) => (
                      <div key={category} className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span>{category}</span>
                          <span>{percentage}%</span>
                        </div>
                        <Progress value={percentage} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
