
import React, { createContext, useContext, useState, ReactNode } from "react";
import { toast } from "sonner";

// Types
export type UserRole = "student" | "teacher" | "admin";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  gender?: string;
  grade?: string;
  educationLevel?: string;
  xp: number;
  level: number;
  avatar: string;
};

interface UserContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profileData: Partial<UserProfile>) => void;
  addXP: (amount: number) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: UserProfile[] = [
  {
    id: "1",
    name: "Demo Student",
    email: "student@example.com",
    role: "student",
    xp: 100,
    level: 1,
    avatar: "avatar-1",
  },
  {
    id: "2",
    name: "Demo Teacher",
    email: "teacher@example.com",
    role: "teacher",
    xp: 500,
    level: 5,
    avatar: "avatar-2",
  },
];

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);

  const calculateLevel = (xp: number) => {
    // Simple level calculation: each level requires 100 XP
    return Math.floor(xp / 100) + 1;
  };
  
  const login = async (email: string, password: string) => {
    try {
      // Mock authentication
      const foundUser = mockUsers.find((u) => u.email === email);
      
      if (foundUser) {
        setUser(foundUser);
        toast.success("Logged in successfully!");
        return;
      }
      
      toast.error("Invalid email or password");
    } catch (error) {
      toast.error("Login failed. Please try again.");
      console.error("Login error:", error);
    }
  };
  
  const signup = async (email: string, password: string, name: string) => {
    try {
      // Mock signup - in a real app, this would create a new user in the database
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        name,
        email,
        role: "student", // Default role
        xp: 0,
        level: 1,
        avatar: "avatar-1", // Default avatar
      };
      
      mockUsers.push(newUser);
      setUser(newUser);
      toast.success("Account created successfully!");
    } catch (error) {
      toast.error("Signup failed. Please try again.");
      console.error("Signup error:", error);
    }
  };
  
  const logout = () => {
    setUser(null);
    toast.info("Logged out successfully");
  };
  
  const updateProfile = (profileData: Partial<UserProfile>) => {
    if (user) {
      setUser({ ...user, ...profileData });
      toast.success("Profile updated successfully!");
    }
  };
  
  const addXP = (amount: number) => {
    if (user) {
      const newXP = user.xp + amount;
      const newLevel = calculateLevel(newXP);
      
      setUser({ ...user, xp: newXP, level: newLevel });
      
      if (newLevel > user.level) {
        toast.success(`Level up! You are now level ${newLevel}!`);
      } else {
        toast.success(`+${amount} XP gained!`);
      }
    }
  };
  
  return (
    <UserContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        updateProfile,
        addXP,
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
