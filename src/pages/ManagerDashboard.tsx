import React, { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Crown, 
  Users, 
  BookOpen, 
  Shield, 
  Settings, 
  BarChart3,
  TrendingUp,
  Globe,
  Award,
  Calendar,
  UserPlus,
  Eye,
  Download,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';

const ManagerDashboard: React.FC = () => {
  const { user } = useUser();
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    role: 'student',
    grade: ''
  });

  // Mock comprehensive data for manager dashboard
  const globalStats = {
    totalUsers: 15847,
    activeUsers: 12543,
    totalTeachers: 287,
    totalAdmins: 15,
    totalStudents: 15545,
    totalQuizzes: 2847,
    completedQuizzes: 47582,
    totalSchools: 145,
    activeTournaments: 12,
    monthlyActiveUsers: 11234
  };

  const regionalStats = [
    { region: "North America", users: 5234, schools: 67, growth: "+12%" },
    { region: "Europe", users: 4521, schools: 43, growth: "+8%" },
    { region: "Asia", users: 3847, schools: 23, growth: "+15%" },
    { region: "Africa", users: 2245, schools: 12, growth: "+22%" }
  ];

  const topSchools = [
    { name: "Lincoln Elementary", students: 234, completion: 94, country: "USA" },
    { name: "Royal Grammar School", students: 189, completion: 91, country: "UK" },
    { name: "International School Tokyo", students: 156, completion: 89, country: "Japan" }
  ];

  const systemHealth = {
    serverUptime: "99.9%",
    avgResponseTime: "120ms",
    totalStorage: "2.4TB",
    usedStorage: "1.8TB",
    dailyBackups: "Successful",
    securityScore: "A+"
  };

  const handleCreateUser = () => {
    if (!newUserData.name || !newUserData.email || !newUserData.role) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    toast.success(`${newUserData.role} account created successfully!`);
    setNewUserData({
      name: '',
      email: '',
      role: 'student',
      grade: ''
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Crown className="h-8 w-8 text-yellow-500" />
              Master Control Dashboard
            </h1>
            <p className="text-gray-600">Welcome back, {user?.name}! You have complete system oversight and control.</p>
          </div>
          <Badge variant="secondary" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2">
            Master Manager
          </Badge>
        </div>

        {/* Global Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-xs">Total Users</p>
                  <p className="text-2xl font-bold">{globalStats.totalUsers.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-xs">Active Users</p>
                  <p className="text-2xl font-bold">{globalStats.activeUsers.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-xs">Total Schools</p>
                  <p className="text-2xl font-bold">{globalStats.totalSchools}</p>
                </div>
                <Globe className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-xs">Tournaments</p>
                  <p className="text-2xl font-bold">{globalStats.activeTournaments}</p>
                </div>
                <Award className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-xs">Total Quizzes</p>
                  <p className="text-2xl font-bold">{globalStats.totalQuizzes.toLocaleString()}</p>
                </div>
                <BookOpen className="h-8 w-8 text-red-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="system">System Health</TabsTrigger>
            <TabsTrigger value="global">Global Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Regional Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Regional Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {regionalStats.map((region, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{region.region}</p>
                          <p className="text-xs text-gray-600">{region.users.toLocaleString()} users • {region.schools} schools</p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {region.growth}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Performing Schools */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Top Performing Schools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topSchools.map((school, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{school.name}</p>
                            <p className="text-xs text-gray-600">{school.students} students • {school.country}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {school.completion}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions for Manager */}
            <Card>
              <CardHeader>
                <CardTitle>Master Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <Button className="flex flex-col items-center gap-2 h-auto py-4">
                    <UserPlus className="h-6 w-6" />
                    <span className="text-sm">Add Users</span>
                  </Button>
                  <Button variant="outline" className="flex flex-col items-center gap-2 h-auto py-4">
                    <Calendar className="h-6 w-6" />
                    <span className="text-sm">Schedule Tournament</span>
                  </Button>
                  <Button variant="outline" className="flex flex-col items-center gap-2 h-auto py-4">
                    <BarChart3 className="h-6 w-6" />
                    <span className="text-sm">Global Analytics</span>
                  </Button>
                  <Button variant="outline" className="flex flex-col items-center gap-2 h-auto py-4">
                    <Shield className="h-6 w-6" />
                    <span className="text-sm">Security</span>
                  </Button>
                  <Button variant="outline" className="flex flex-col items-center gap-2 h-auto py-4">
                    <Download className="h-6 w-6" />
                    <span className="text-sm">Export Data</span>
                  </Button>
                  <Button variant="outline" className="flex flex-col items-center gap-2 h-auto py-4">
                    <Settings className="h-6 w-6" />
                    <span className="text-sm">System Config</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New User Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Full Name</Label>
                    <Input
                      id="user-name"
                      value={newUserData.name}
                      onChange={(e) => setNewUserData({...newUserData, name: e.target.value})}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email Address</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Role</Label>
                    <Select value={newUserData.role} onValueChange={(value) => setNewUserData({...newUserData, role: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUserData.role === 'student' && (
                    <div className="space-y-2">
                      <Label htmlFor="user-grade">Grade Level</Label>
                      <Select value={newUserData.grade} onValueChange={(value) => setNewUserData({...newUserData, grade: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
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
                  )}
                </div>
                
                <Button onClick={handleCreateUser} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create User Account
                </Button>
              </CardContent>
            </Card>

            {/* User Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{globalStats.totalStudents.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Total Students</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{globalStats.totalTeachers}</p>
                  <p className="text-sm text-gray-600">Total Teachers</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{globalStats.totalAdmins}</p>
                  <p className="text-sm text-gray-600">Total Admins</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{globalStats.monthlyActiveUsers.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Monthly Active</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Global Platform Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Advanced Global Analytics</h3>
                  <p className="text-gray-500 mb-4">
                    Comprehensive platform analytics including user engagement, learning outcomes, 
                    regional performance, and predictive insights will be available here.
                  </p>
                  <Button variant="outline">Coming Soon</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tournaments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Global Tournament Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
                  <div>
                    <h3 className="font-medium">World Championship 2024</h3>
                    <p className="text-sm text-gray-600">Global tournament with 2,847 participants</p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">Active</Badge>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium">Regional Math Olympics</h3>
                    <p className="text-sm text-gray-600">Mathematics competition for grades 6-8</p>
                  </div>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">Scheduled</Badge>
                </div>

                <Button className="w-full">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule New Global Tournament
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Health Monitor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800">Server Uptime</h4>
                    <p className="text-2xl font-bold text-green-600">{systemHealth.serverUptime}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800">Avg Response Time</h4>
                    <p className="text-2xl font-bold text-blue-600">{systemHealth.avgResponseTime}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-purple-800">Security Score</h4>
                    <p className="text-2xl font-bold text-purple-600">{systemHealth.securityScore}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-medium text-orange-800">Storage Used</h4>
                    <p className="text-2xl font-bold text-orange-600">{systemHealth.usedStorage}</p>
                    <p className="text-sm text-gray-600">of {systemHealth.totalStorage}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800">Daily Backups</h4>
                    <p className="text-2xl font-bold text-green-600">{systemHealth.dailyBackups}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="global" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Global Platform Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Platform Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Global XP Multiplier</Label>
                        <Input type="number" defaultValue="1.0" step="0.1" />
                      </div>
                      <div className="space-y-2">
                        <Label>Tournament Entry Fee (Coins)</Label>
                        <Input type="number" defaultValue="100" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Feature Toggles</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Global Leaderboards</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">International Tournaments</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">AI Helper Global Access</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">Enabled</Badge>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full">Save Global Settings</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ManagerDashboard;