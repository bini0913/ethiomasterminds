import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

// Types
export type UserRole = "student" | "teacher" | "admin" | "manager" | "extreme_admin";

export interface AvatarConfig {
  bodyType?: string;
  skinTone?: string;
  hairstyle?: string;
  hairColor?: string;
  outfit?: string;
  outfitColor?: string;
  accessory?: string;
  background?: string;
  expression?: string;
}

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
  avatarConfig?: AvatarConfig | null;
  rank?: string;
  badges?: string[];
};

interface UserContextType {
  user: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithUsername: (username: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  signupWithRole: (email: string, password: string, name: string, username: string, role: UserRole, grade?: string) => Promise<boolean>;
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

  const createMissingProfile = async (userId: string) => {
    const fallbackName =
      session?.user?.user_metadata?.name ||
      session?.user?.email?.split("@")[0] ||
      "Student";
    const fallbackUsername =
      session?.user?.user_metadata?.username ||
      session?.user?.email?.split("@")[0] ||
      `user-${userId.slice(0, 6)}`;

    const { error } = await (supabase as any)
      .from("profiles")
      .upsert({
        id: userId,
        name: fallbackName,
        username: String(fallbackUsername).toLowerCase(),
        avatar: "avatar-1",
        level: 1,
        xp: 0,
      });

    if (error) {
      throw error;
    }
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
        if (profileError.code === "PGRST116") {
          await createMissingProfile(userId);
          return await fetchUserProfile(userId);
        }
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
        avatarConfig: profile.avatar_config as AvatarConfig | null,
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

  // Login with email (legacy)
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

  // Login with username (new)
  const loginWithUsername = async (username: string, password: string): Promise<boolean> => {
    try {
      if (!username.trim() || !password.trim()) {
        toast.error("Please enter both username and password");
        return false;
      }

      // Get email from username using RPC
      const { data: email, error: lookupError } = await supabase
        .rpc('get_email_by_username', { p_username: username.trim() });

      if (lookupError) {
        console.error('Username lookup error:', lookupError);
        toast.error("Failed to find user. Please try again.");
        return false;
      }

      if (!email) {
        toast.error("Username not found");
        return false;
      }

      // Login with email/password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password.trim(),
      });

      if (error) {
        console.error('Login error:', error);
        if (error.message.includes('Invalid login')) {
          toast.error("Invalid username or password");
        } else {
          toast.error(error.message || "Login failed");
        }
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

  // Legacy signup (creates as student)
  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    return signupWithRole(email, password, name, email.split('@')[0], 'student');
  };

  // New signup with role selection
  const signupWithRole = async (
    email: string, 
    password: string, 
    name: string, 
    username: string,
    role: UserRole,
    grade?: string,
  ): Promise<boolean> => {
    try {
      if (role !== 'student') {
        toast.error("Only student accounts can be created through sign up.");
        return false;
      }

      if (!email.trim() || !password.trim() || !name.trim() || !username.trim()) {
        toast.error("Please fill all required fields");
        return false;
      }

      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return false;
      }


      // Check if username is already taken
      const { data: existingEmail } = await supabase
        .rpc('get_email_by_username', { p_username: username.trim() });

      if (existingEmail) {
        toast.error("Username is already taken");
        return false;
      }

      const redirectUrl = `${window.location.origin}/`;

      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: name.trim(),
            username: username.trim().toLowerCase(),
            ...(grade?.trim()
              ? {
                  grade: grade.trim(),
                  education_level:
                    grade.trim().toLowerCase() === "k" || /^grade\s*[1-4]$/i.test(grade.trim())
                      ? "early"
                      : /^grade\s*[5-8]$/i.test(grade.trim())
                        ? "middle"
                        : "upper",
                }
              : {}),
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
        // Wait for profile to be created by trigger
        await new Promise(resolve => setTimeout(resolve, 500));

        // Assign role via edge function
        const { data: roleData, error: roleError } = await supabase.functions.invoke('assign-role', {
          body: { role }
        });

        if (roleError || !roleData?.ok) {
          console.error('Role assignment error:', roleError || roleData?.error);
          // Role assignment failed, but account was created - they'll be without a role
          // This shouldn't happen but we handle it gracefully
          toast.warning("Account created but role assignment failed. Please contact support.");
        } else {
          toast.success(`Welcome to Master Minds, ${name}!`);
        }

        // Refresh profile to get updated role
        await refreshProfile();
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
    // Clear local app state immediately so logout always works on mobile/offline
    // even if the remote session-revocation request is temporarily unavailable.
    localStorage.removeItem("masterminds_login_mode");
    setUser(null);
    setSession(null);
    setShowLevelUp(false);

    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      toast.info("Logged out successfully");
    } catch (error) {
      console.error("Global logout error:", error);
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (localError) {
        console.error("Local logout fallback error:", localError);
      }
      toast.info("Logged out on this device");
    }
  };

  const updateProfile = async (profileData: Partial<UserProfile>) => {
    if (!user || !session?.user) return;

    try {
      const updateData: any = {};
      
      if (profileData.name !== undefined) updateData.name = profileData.name;
      if (profileData.username !== undefined) updateData.username = profileData.username;
      if (profileData.gender !== undefined) updateData.gender = profileData.gender;
      if (profileData.grade !== undefined) updateData.grade = profileData.grade;
      if (profileData.educationLevel !== undefined) updateData.education_level = profileData.educationLevel;
      // XP/level/rank/badges are progression-owned fields and cannot be edited
      // through the general profile update path.
      if (profileData.avatar !== undefined) updateData.avatar = profileData.avatar;
      if (profileData.avatarConfig !== undefined) updateData.avatar_config = profileData.avatarConfig;
      // Badges are progression-owned and can only be changed by server-side achievement logic.

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

    try {
      const { data, error } = await supabase.rpc('add_xp', {
        p_user_id: session.user.id,
        p_amount: amount,
      });

      if (error) throw error;

      const result = data as {
        previous_xp?: number;
        new_xp?: number;
        previous_level?: number;
        new_level?: number;
        leveled_up?: boolean;
      };

      const newXP = Number(result?.new_xp ?? user.xp);
      const newLevel = Number(result?.new_level ?? user.level);

      if (newLevel > user.level) {
        setPreviousLevel(user.level);
        setTimeout(() => setShowLevelUp(true), 500);
      }

      setUser(prev => prev ? { ...prev, xp: newXP, level: newLevel } : null);

      if (newLevel <= user.level) {
        toast.success(`+${amount} XP gained!`);
      }
    } catch (error) {
      console.error('Add XP error:', error);
      toast.error('Unable to add XP securely.');
    }
  };

  const deleteAccount = async () => {
    if (!session?.user) return;

    try {
      // Note: Full account deletion requires admin privileges
      // For now, we sign out the user
      await supabase.auth.signOut();
      localStorage.removeItem("masterminds_login_mode");
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
        loginWithUsername,
        signup,
        signupWithRole,
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
