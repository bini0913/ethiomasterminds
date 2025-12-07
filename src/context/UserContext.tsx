import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

// Types
export type UserRole = "student" | "teacher" | "admin" | "manager";

export type UserProfile = {
  id: string;
  name: string;
  email?: string;
  username?: string;
  role: UserRole;
  gender?: string;
  grade?: string;
  educationLevel?: string;
  xp: number;
  level: number;
  avatar: string;
  rank?: string;
  badges?: string[];
};

interface UserContextType {
  user: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (profileData: Partial<UserProfile>) => Promise<void>;
  addXP: (amount: number) => Promise<void>;
  deleteAccount: () => Promise<void>;
  getAllUsers: () => Promise<Array<Omit<UserProfile, 'password'>>>;
  deleteUserById: (id: string) => Promise<void>;
  showLevelUp: boolean;
  setShowLevelUp: (show: boolean) => void;
  previousLevel: number;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLevelUp, setShowLevelUp] = useState<boolean>(false);
  const [previousLevel, setPreviousLevel] = useState<number>(1);

  const calculateLevel = (xp: number) => {
    return Math.floor(xp / 100) + 1;
  };

  // Fetch user profile and role from database
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      // Fetch role using the secure function
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role', { _user_id: userId });

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      const role = (roleData as UserRole) || 'student';

      return {
        id: profile.id,
        name: profile.name,
        username: profile.username || undefined,
        email: session?.user?.email,
        role,
        gender: profile.gender || undefined,
        grade: profile.grade || undefined,
        educationLevel: profile.education_level || undefined,
        xp: profile.xp || 0,
        level: profile.level || 1,
        avatar: profile.avatar || 'avatar-1',
        rank: profile.rank || undefined,
        badges: profile.badges || [],
      };
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  };

  // Set up auth state listener
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        
        if (newSession?.user) {
          // Use setTimeout to prevent deadlock
          setTimeout(() => {
            fetchUserProfile(newSession.user.id).then(profile => {
              setUser(profile);
              setIsLoading(false);
            });
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      if (existingSession?.user) {
        fetchUserProfile(existingSession.user.id).then(profile => {
          setUser(profile);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (session?.user) {
      const profile = await fetchUserProfile(session.user.id);
      setUser(profile);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      if (!email.trim() || !password.trim()) {
        toast.error("Please enter both email and password");
        return false;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        console.error('Login error:', error);
        toast.error(error.message || "Invalid email or password");
        return false;
      }

      if (data.user) {
        toast.success(`Welcome back!`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      toast.error("Login failed. Please try again.");
      return false;
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      if (!email.trim() || !password.trim() || !name.trim()) {
        toast.error("Please fill all required fields");
        return false;
      }

      if (password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return false;
      }

      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: name.trim(),
            username: email.split('@')[0],
          }
        }
      });

      if (error) {
        console.error('Signup error:', error);
        if (error.message.includes('already registered')) {
          toast.error("This email is already registered. Please log in instead.");
        } else {
          toast.error(error.message || "Signup failed");
        }
        return false;
      }

      if (data.user) {
        toast.success("Account created successfully!");
        return true;
      }

      return false;
    } catch (error) {
      console.error('Signup error:', error);
      toast.error("Signup failed. Please try again.");
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      toast.info("Logged out successfully");
    } catch (error) {
      console.error('Logout error:', error);
      toast.error("Logout failed");
    }
  };

  const updateProfile = async (profileData: Partial<UserProfile>) => {
    if (!user || !session?.user) return;

    try {
      const updateData: Record<string, unknown> = {};
      
      if (profileData.name !== undefined) updateData.name = profileData.name;
      if (profileData.username !== undefined) updateData.username = profileData.username;
      if (profileData.gender !== undefined) updateData.gender = profileData.gender;
      if (profileData.grade !== undefined) updateData.grade = profileData.grade;
      if (profileData.educationLevel !== undefined) updateData.education_level = profileData.educationLevel;
      if (profileData.xp !== undefined) updateData.xp = profileData.xp;
      if (profileData.level !== undefined) updateData.level = profileData.level;
      if (profileData.avatar !== undefined) updateData.avatar = profileData.avatar;
      if (profileData.rank !== undefined) updateData.rank = profileData.rank;
      if (profileData.badges !== undefined) updateData.badges = profileData.badges;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', session.user.id);

      if (error) {
        console.error('Update profile error:', error);
        toast.error("Failed to update profile");
        return;
      }

      // Update local state
      setUser(prev => prev ? { ...prev, ...profileData } : null);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error('Update profile error:', error);
      toast.error("Failed to update profile");
    }
  };

  const addXP = async (amount: number) => {
    if (!user || !session?.user) return;

    const newXP = user.xp + amount;
    const newLevel = calculateLevel(newXP);

    if (newLevel > user.level) {
      setPreviousLevel(user.level);
      setTimeout(() => {
        setShowLevelUp(true);
      }, 500);
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ xp: newXP, level: newLevel })
        .eq('id', session.user.id);

      if (error) {
        console.error('Add XP error:', error);
        return;
      }

      setUser(prev => prev ? { ...prev, xp: newXP, level: newLevel } : null);

      if (newLevel <= user.level) {
        toast.success(`+${amount} XP gained!`);
      }
    } catch (error) {
      console.error('Add XP error:', error);
    }
  };

  const deleteAccount = async () => {
    if (!session?.user) return;

    try {
      // Note: Full account deletion requires admin privileges
      // For now, we sign out the user
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      toast.success("You have been logged out. Contact support to fully delete your account.");
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error("Failed to delete account");
    }
  };

  const getAllUsers = async (): Promise<Array<Omit<UserProfile, 'password'>>> => {
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return [];
    }

    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        console.error('Get all users error:', error);
        return [];
      }

      // Fetch roles for all users
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .rpc('get_user_role', { _user_id: profile.id });

          return {
            id: profile.id,
            name: profile.name,
            username: profile.username || undefined,
            role: (roleData as UserRole) || 'student',
            gender: profile.gender || undefined,
            grade: profile.grade || undefined,
            educationLevel: profile.education_level || undefined,
            xp: profile.xp || 0,
            level: profile.level || 1,
            avatar: profile.avatar || 'avatar-1',
            rank: profile.rank || undefined,
            badges: profile.badges || [],
          };
        })
      );

      return usersWithRoles;
    } catch (error) {
      console.error('Get all users error:', error);
      return [];
    }
  };

  const deleteUserById = async (id: string) => {
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      toast.error("You don't have permission to delete users");
      return;
    }

    if (user.id === id) {
      await deleteAccount();
      return;
    }

    // Note: Deleting other users requires admin API access
    toast.info("User deletion requires admin privileges. Contact system administrator.");
  };

  return (
    <UserContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session?.user,
        isLoading,
        login,
        signup,
        logout,
        updateProfile,
        addXP,
        deleteAccount,
        getAllUsers,
        deleteUserById,
        showLevelUp,
        setShowLevelUp,
        previousLevel,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
