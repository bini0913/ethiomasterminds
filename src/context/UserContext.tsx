import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { toast } from "sonner";

// Types
export type UserRole = "student" | "teacher" | "admin" | "manager";

export type UserProfile = {
  id: string;
  name: string;
  email?: string;
  username: string;
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
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, password: string, name: string) => Promise<boolean>;
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

const USER_STORAGE_KEY = "masterminds_user";
const USERS_STORAGE_KEY = "masterminds_users";

// Test accounts - username/password only, no codes required
const TEST_ACCOUNTS = [
  { username: "student1", password: "pass123", role: "student" as UserRole, name: "Student One" },
  { username: "teacher1", password: "pass123", role: "teacher" as UserRole, name: "Teacher One" },
  { username: "teacher2", password: "pass123", role: "teacher" as UserRole, name: "Teacher Two" },
  { username: "admin1", password: "pass123", role: "admin" as UserRole, name: "Admin One" },
  { username: "admin2", password: "pass123", role: "admin" as UserRole, name: "Admin Two" },
  { username: "biniam", password: "2004", role: "manager" as UserRole, name: "Biniam Bogale - Master Manager" },
];

// Simple hash function for demo purposes
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showLevelUp, setShowLevelUp] = useState<boolean>(false);
  const [previousLevel, setPreviousLevel] = useState<number>(1);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize test accounts
  useEffect(() => {
    const initializeAccounts = async () => {
      const usersStr = localStorage.getItem(USERS_STORAGE_KEY);
      let users: Array<any> = usersStr ? JSON.parse(usersStr) : [];
      
      // Add test accounts if they don't exist
      for (const account of TEST_ACCOUNTS) {
        const exists = users.some(u => u.username === account.username);
        if (!exists) {
          const hashedPassword = await hashPassword(account.password);
          users.push({
            id: `user-${account.username}-${Date.now()}`,
            username: account.username,
            password: hashedPassword,
            name: account.name,
            role: account.role,
            xp: 0,
            level: 1,
            avatar: "avatar-1",
            grade: account.role === "student" ? "5" : undefined,
            gender: "other",
            educationLevel: "primary"
          });
        }
      }
      
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      setIsInitialized(true);
    };

    initializeAccounts();
  }, []);

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

  const calculateLevel = (xp: number) => {
    return Math.floor(xp / 100) + 1;
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      if (!username.trim() || !password.trim()) {
        toast.error("Please enter both username and password");
        return false;
      }

      const hashedPassword = await hashPassword(password);
      const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
      const users: Array<any> = JSON.parse(usersStr);

      const foundUser = users.find(u => 
        u.username?.toLowerCase() === username.toLowerCase() && 
        u.password === hashedPassword
      );

      if (foundUser) {
        const { password: _, ...userWithoutPassword } = foundUser;
        setUser(userWithoutPassword);
        toast.success(`Welcome back, ${foundUser.name}!`, {
          description: `Logged in as ${foundUser.role}`
        });
        return true;
      }

      toast.error("Invalid username or password", {
        description: "Please check your credentials and try again"
      });
      return false;
    } catch (error) {
      toast.error("Login failed. Please try again.");
      console.error("Login error:", error);
      return false;
    }
  };

  const signup = async (username: string, password: string, name: string): Promise<boolean> => {
    try {
      if (!username.trim() || !password.trim() || !name.trim()) {
        toast.error("Please fill all required fields");
        return false;
      }

      const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
      const users: Array<any> = JSON.parse(usersStr);

      if (users.some(u => u.username?.toLowerCase() === username.toLowerCase())) {
        toast.error("Username already exists");
        return false;
      }

      const hashedPassword = await hashPassword(password);
      
      const newUser = {
        id: `user-${Date.now()}`,
        name,
        username,
        password: hashedPassword,
        role: "student" as UserRole,
        xp: 0,
        level: 1,
        avatar: "avatar-1",
      };

      users.push(newUser);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

      const { password: _, ...userWithoutPassword } = newUser;
      setUser(userWithoutPassword);
      toast.success("Account created successfully!");
      return true;
    } catch (error) {
      toast.error("Signup failed. Please try again.");
      console.error("Signup error:", error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    toast.info("Logged out successfully");
  };

  const updateProfile = (profileData: Partial<UserProfile>) => {
    if (!user) return;

    const updatedUser = { ...user, ...profileData };
    setUser(updatedUser);

    const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
    const users: Array<any> = JSON.parse(usersStr);

    const updatedUsers = users.map(u => {
      if (u.id === user.id) {
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

    if (newLevel > user.level) {
      setPreviousLevel(user.level);
      setTimeout(() => {
        setShowLevelUp(true);
      }, 500);
    }

    const updatedUser = { ...user, xp: newXP, level: newLevel };
    updateProfile(updatedUser);

    if (newLevel <= user.level) {
      toast.success(`+${amount} XP gained!`);
    }
  };

  const deleteAccount = () => {
    if (!user) return;

    const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
    const users: Array<any> = JSON.parse(usersStr);

    const updatedUsers = users.filter(u => u.id !== user.id);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));

    setUser(null);
    toast.success("Your account has been deleted");
  };

  const getAllUsers = () => {
    const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
    const users: Array<any> = JSON.parse(usersStr);
    return users.map(({ password, ...user }) => user);
  };

  const deleteUserById = (id: string) => {
    const usersStr = localStorage.getItem(USERS_STORAGE_KEY) || "[]";
    const users: Array<any> = JSON.parse(usersStr);

    if (user?.id === id) {
      deleteAccount();
      return;
    }

    const updatedUsers = users.filter(u => u.id !== id);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));

    toast.success("User account deleted successfully");
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
