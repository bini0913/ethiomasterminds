import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { 
  User, GraduationCap, Shield, Eye, EyeOff, Loader2, 
  LogIn, UserPlus, Key, Mail, Lock
} from 'lucide-react';

interface RoleLoginFormProps {
  onSuccess?: () => void;
}

const RoleLoginForm: React.FC<RoleLoginFormProps> = ({ onSuccess }) => {
  const { login, signup } = useUser();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [role, setRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    username: '',
    accessCode: ''
  });

  const validateAccessCode = async (code: string, codeType: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('access_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('code_type', codeType)
      .eq('is_used', false)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  };

  const markCodeAsUsed = async (code: string, userId: string) => {
    await supabase
      .from('access_codes')
      .update({ is_used: true, used_by: userId })
      .eq('code', code.toUpperCase());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate access code for teacher/admin
    if (mode === 'signup' && (role === 'teacher' || role === 'admin')) {
      if (!formData.accessCode) {
        toast.error(`Please enter a valid ${role} access code`);
        return;
      }

      const isValidCode = await validateAccessCode(formData.accessCode, role);
      if (!isValidCode) {
        toast.error(`Invalid or already used ${role} code`);
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const success = await login(formData.email, formData.password);
        if (!success) {
          setLoading(false);
          return;
        }
        onSuccess?.();
      } else {
        const success = await signup(
          formData.email, 
          formData.password, 
          formData.name || formData.email.split('@')[0]
        );
        
        if (!success) {
          setLoading(false);
          return;
        }

        // Mark access code as used for teacher/admin
        if (role === 'teacher' || role === 'admin') {
          // Get current user after signup
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            await markCodeAsUsed(formData.accessCode, currentUser.id);
            // Update user role
            await supabase.from('user_roles').update({ role }).eq('user_id', currentUser.id);
          }
        }

        toast.success('Account created successfully!');
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    }

    setLoading(false);
  };

  const roleConfig = {
    student: {
      icon: GraduationCap,
      color: 'from-blue-500 to-cyan-500',
      title: 'Student',
      description: 'Learn and compete with others'
    },
    teacher: {
      icon: User,
      color: 'from-green-500 to-emerald-500',
      title: 'Teacher',
      description: 'Create quizzes and manage students'
    },
    admin: {
      icon: Shield,
      color: 'from-red-500 to-orange-500',
      title: 'Admin',
      description: 'Full system control'
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Sign in to continue' : 'Join Master Minds today'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'signup')}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login" className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Login
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Sign Up
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label>Select Role</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['student', 'teacher', 'admin'] as const).map((r) => {
                const config = roleConfig[r];
                const Icon = config.icon;
                return (
                  <motion.button
                    key={r}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setRole(r)}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      role === r 
                        ? `border-primary bg-gradient-to-br ${config.color} text-white` 
                        : 'border-border hover:border-primary/50 bg-muted/50'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-2 ${role === r ? 'text-white' : 'text-muted-foreground'}`} />
                    <p className={`text-sm font-medium ${role === r ? 'text-white' : ''}`}>
                      {config.title}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    className="pl-10"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {/* Access Code for Teacher/Admin */}
            {mode === 'signup' && (role === 'teacher' || role === 'admin') && (
              <div className="space-y-2">
                <Label htmlFor="accessCode" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  {role === 'teacher' ? 'Teacher' : 'Admin'} Access Code
                </Label>
                <Input
                  id="accessCode"
                  placeholder={`Enter ${role} code`}
                  value={formData.accessCode}
                  onChange={(e) => setFormData({ ...formData, accessCode: e.target.value.toUpperCase() })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Contact an administrator to get an access code
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              className={`w-full bg-gradient-to-r ${roleConfig[role].color} text-white`}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Default Codes Info */}
          {mode === 'signup' && (role === 'teacher' || role === 'admin') && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="text-muted-foreground text-center">
                Default codes: <span className="font-mono">TEACHER2024</span> or <span className="font-mono">ADMIN2024</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default RoleLoginForm;
