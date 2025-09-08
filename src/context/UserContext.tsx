import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { toast } from "sonner";

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
  // New fields for enhanced leveling system
  rank?: string;
  badges?: string[];
};

interface UserContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (emailOrUsername: string, password: string, type?: "student" | "teacher" | "admin" | "manager") => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profileData: Partial<UserProfile>) => void;
  addXP: (amount: number) => void;
  deleteAccount: () => void;
  getAllUsers: () => Array<Omit<UserProfile, 'password'>>;
  deleteUserById: (id: string) => void;
  showLevelUp: boolean;
  setShowLevelUp: (show: boolean) => void;
  previousLevel: number;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// User storage key
const USER_STORAGE_KEY = "masterminds_user";
const USERS_STORAGE_KEY = "masterminds_users";

// Predefined credentials as requested by Master Minds specifications
const PREDEFINED_CREDENTIALS = [
  { username: "biniam", password: "2004", role: "manager", name: "Biniam Bogale - Master Manager" },
  { username: "teacher1", password: "111", role: "teacher", name: "Teacher One" },
  { username: "teacher2", password: "111", role: "teacher", name: "Teacher Two" },
  { username: "teacher3", password: "111", role: "teacher", name: "Teacher Three" },
  { username: "teacher4", password: "111", role: "teacher", name: "Teacher Four" },
  { username: "teacher5", password: "111", role: "teacher", name: "Teacher Five" },
  { username: "admin1", password: "222", role: "admin", name: "Admin One" },
  { username: "admin2", password: "222", role: "admin", name: "Admin Two" },
  { username: "admin3", password: "222", role: "admin", name: "Admin Three" },
];

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showLevelUp, setShowLevelUp] = useState<boolean>(false);
  const [previousLevel, setPreviousLevel] = useState<number>(1);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
      }
    }
  }, []);

  // Save user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  // Ensure predefined credentials are stored in localStorage
  useEffect(() => {
    const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
    let users: Array<any> = JSON.parse(usersStr);
    
    // Check if we need to add predefined credentials
    let needsUpdate = false;
    
    for (const cred of PREDEFINED_CREDENTIALS) {
      const exists = users.some(u => 
        u.username === cred.username && 
        u.role === cred.role
      );
      
      if (!exists) {
        needsUpdate = true;
        // Generate hashed password for the predefined credential
        hashPassword(cred.password).then(hashedPassword => {
          users.push({
            id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            username: cred.username,
            password: hashedPassword,
            name: cred.name,
            role: cred.role,
            xp: 0,
            level: 1,
            avatar: "avatar-1",
          });
        });
      }
    }
    
    if (needsUpdate) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
  }, []);

  const calculateLevel = (xp: number) => {
    // Simple level calculation: each level requires 100 XP
    return Math.floor(xp / 100) + 1;
  };
  
  const login = async (emailOrUsername: string, password: string, type: "student" | "teacher" | "admin" | "manager" = "student") => {
    try {
      // Validate input
      if (!emailOrUsername || !password) {
        toast.error("Please enter both email/username and password");
        return;
      }

      // Create a hash of the password (for demo purposes only - NOT secure)
      const hashedPassword = await hashPassword(password);
      
      // Check if user exists in localStorage
      const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
      const users: Array<any> = JSON.parse(usersStr);
      
      let foundUser;
      
      if (type === "student") {
        // Student login - using email
        foundUser = users.find(u => 
          u.email?.toLowerCase() === emailOrUsername.toLowerCase() && 
          u.password === hashedPassword &&
          u.role === "student"
        );
      } else {
        // Teacher, admin or manager login - using username
        foundUser = users.find(u => 
          u.username?.toLowerCase() === emailOrUsername.toLowerCase() && 
          u.password === hashedPassword &&
          u.role === type
        );
      }
      
      if (foundUser) {
        // Remove password before setting in state
        const { password, ...userWithoutPassword } = foundUser;
        setUser(userWithoutPassword);
        toast.success("Logged in successfully!");
        return;
      }
      
      if (type === "student") {
        toast.error("Invalid email or password");
      } else {
        toast.error(`Invalid ${type} credentials`);
      }
    } catch (error) {
      toast.error("Login failed. Please try again.");
      console.error("Login error:", error);
    }
  };
  
  const signup = async (email: string, password: string, name: string) => {
    try {
      // Validate input
      if (!email || !password || !name) {
        toast.error("Please fill all required fields");
        return;
      }

      // Check if user already exists
      const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
      const users: Array<UserProfile & { password: string }> = JSON.parse(usersStr);
      
      if (users.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
        toast.error("User with this email already exists");
        return;
      }
      
      // Create hashed password (demo only - NOT secure)
      const hashedPassword = await hashPassword(password);
      
      // Create new user
      const newUser: UserProfile & { password: string } = {
        id: `user-${Date.now()}`,
        name,
        email,
        password: hashedPassword,
        role: "student", // Default role
        xp: 0,
        level: 1,
        avatar: "avatar-1", // Default avatar
      };
      
      // Save to "database" (localStorage)
      users.push(newUser);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      
      // Login the user (without password in state)
      const { password: _, ...userWithoutPassword } = newUser;
      setUser(userWithoutPassword);
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
    if (!user) return;
    
    // Update user in state
    const updatedUser = { ...user, ...profileData };
    setUser(updatedUser);
    
    // Update user in storage
    const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
    const users: Array<UserProfile & { password: string }> = JSON.parse(usersStr);
    
    const updatedUsers = users.map(u => {
      if (u.id === user.id) {
        // Preserve the password field which isn't in the state
        return { ...u, ...profileData };
      }
      return u;
    });
    
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
    toast.success("Profile updated successfully!");
  };
  
  const addXP = (amount: number) => {
    if (!user) return;
    
    const newXP = user.xp + amount;
    const newLevel = calculateLevel(newXP);
    
    // If the user is leveling up, show the level up modal
    if (newLevel > user.level) {
      setPreviousLevel(user.level);
      setTimeout(() => {
        setShowLevelUp(true);
      }, 500);
    }
    
    // Update user with new XP and possibly new level
    const updatedUser = { ...user, xp: newXP, level: newLevel };
    updateProfile(updatedUser);
    
    // We'll let the LevelUpModal handle the level up notification now
    if (newLevel <= user.level) {
      toast.success(`+${amount} XP gained!`);
    }
  };

  // Delete the currently logged-in user's account
  const deleteAccount = () => {
    if (!user) return;
    
    // Remove from storage
    const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
    const users: Array<UserProfile & { password: string }> = JSON.parse(usersStr);
    
    const updatedUsers = users.filter(u => u.id !== user.id);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
    
    // Clear current user
    setUser(null);
    toast.success("Your account has been deleted");
  };

  // Get all users (for admin functions)
  const getAllUsers = () => {
    const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
    const users: Array<UserProfile & { password: string }> = JSON.parse(usersStr);
    
    // Remove passwords from the returned data
    return users.map(({password, ...user}) => user);
  };

  // Delete any user by ID (admin function)
  const deleteUserById = (id: string) => {
    const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
    const users: Array<UserProfile & { password: string }> = JSON.parse(usersStr);
    
    // If attempting to delete the current user, use deleteAccount instead
    if (user?.id === id) {
      deleteAccount();
      return;
    }
    
    const updatedUsers = users.filter(u => u.id !== id);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
    
    toast.success("User account deleted successfully");
  };

  // Simple password hashing function (NOT secure - just for demo)
  const hashPassword = async (password: string): Promise<string> => {
    // In a real app, use a proper hashing algorithm like bcrypt
    // This is just a simple demo hash
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
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
        deleteAccount,
        getAllUsers,
        deleteUserById,
        showLevelUp,
        setShowLevelUp,
        previousLevel
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
