
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// Mock data for demonstration
const usersData = [
  { month: 'Jan', users: 400 },
  { month: 'Feb', users: 300 },
  { month: 'Mar', users: 500 },
  { month: 'Apr', users: 780 },
  { month: 'May', users: 890 },
  { month: 'Jun', users: 1390 },
  { month: 'Jul', users: 1490 },
];

const quizCompletions = [
  { month: 'Jan', completions: 240 },
  { month: 'Feb', completions: 139 },
  { month: 'Mar', completions: 980 },
  { month: 'Apr', completions: 390 },
  { month: 'May', completions: 480 },
  { month: 'Jun', completions: 380 },
  { month: 'Jul', completions: 430 },
];

const recentUsers = [
  { id: 1, name: "Alex Johnson", email: "alex@example.com", role: "Student", date: "2023-07-01", status: "active" },
  { id: 2, name: "Samantha Lee", email: "sam@example.com", role: "Teacher", date: "2023-07-02", status: "pending" },
  { id: 3, name: "Raj Patel", email: "raj@example.com", role: "Student", date: "2023-07-03", status: "active" },
  { id: 4, name: "Emma Wilson", email: "emma@example.com", role: "Student", date: "2023-07-04", status: "active" },
  { id: 5, name: "Michael Brown", email: "michael@example.com", role: "Teacher", date: "2023-07-05", status: "inactive" },
];

const reportedContent = [
  { id: 1, content: "Inappropriate question in Physics quiz", reporter: "Teacher: John Smith", date: "2023-07-01", status: "pending" },
  { id: 2, content: "Offensive message in chat", reporter: "Student: Maria Garcia", date: "2023-07-02", status: "reviewed" },
  { id: 3, content: "Incorrect answer in Biology quiz", reporter: "Student: David Kim", date: "2023-07-03", status: "resolved" },
  { id: 4, content: "Misleading information in Chemistry content", reporter: "Teacher: Lisa Chen", date: "2023-07-04", status: "pending" },
];

const AdminDashboard: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const { toast } = useToast();
  
  const handleReportAction = (action: string) => {
    toast({
      title: `Report ${action}`,
      description: `The reported content has been ${action.toLowerCase()}.`,
    });
    setSelectedReport(null);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="content">Content Moderation</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Total user registrations over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <LineChart width={500} height={300} data={usersData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="users" stroke="#8884d8" activeDot={{ r: 8 }} />
                  </LineChart>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Quiz Completions</CardTitle>
                <CardDescription>Number of quizzes completed monthly</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <BarChart width={500} height={300} data={quizCompletions} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completions" fill="#82ca9d" />
                  </BarChart>
                </div>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Recent User Registrations</CardTitle>
                <CardDescription>Latest users who joined the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.role}</TableCell>
                          <TableCell>{user.date}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={user.status === "active" ? "default" : 
                                     user.status === "pending" ? "secondary" : 
                                     "destructive"}
                            >
                              {user.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm">View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>Content Moderation</CardTitle>
              <CardDescription>Review and manage reported content</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Content</TableHead>
                      <TableHead>Reported By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportedContent.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>{report.content}</TableCell>
                        <TableCell>{report.reporter}</TableCell>
                        <TableCell>{report.date}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={report.status === "pending" ? "secondary" : 
                                   report.status === "reviewed" ? "default" : 
                                   "outline"}
                          >
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setSelectedReport(report)}
                              >
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Review Reported Content</DialogTitle>
                                <DialogDescription>
                                  Examine the report and take appropriate action.
                                </DialogDescription>
                              </DialogHeader>
                              {selectedReport && (
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-medium">Reported Content:</h4>
                                    <p className="mt-1 text-sm">{selectedReport.content}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium">Reported By:</h4>
                                    <p className="mt-1 text-sm">{selectedReport.reporter}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium">Date Reported:</h4>
                                    <p className="mt-1 text-sm">{selectedReport.date}</p>
                                  </div>
                                </div>
                              )}
                              <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setSelectedReport(null)}>
                                  Cancel
                                </Button>
                                <Button variant="destructive" onClick={() => handleReportAction('Removed')}>
                                  Remove Content
                                </Button>
                                <Button onClick={() => handleReportAction('Approved')}>
                                  Approve Content
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage system users</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-10 text-muted-foreground">
                Detailed user management interface coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure system-wide settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-10 text-muted-foreground">
                System settings configuration coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
