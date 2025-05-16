
import React, { createContext, useContext, useState, ReactNode } from "react";

type Language = "english" | "amharic" | "afaan-oromoo";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Basic translations for demo
const translations: Record<Language, Record<string, string>> = {
  english: {
    welcome: "Welcome to",
    settings: "Settings",
    profile: "Profile",
    language: "Language",
    english: "English",
    amharic: "Amharic",
    "afaan-oromoo": "Afaan Oromoo",
    save: "Save",
    cancel: "Cancel",
    quiz: "Quiz",
    multiplayer: "Multiplayer",
    leaderboard: "Leaderboard",
    friends: "Friends",
    logout: "Logout",
    "daily-challenge": "Daily Challenge",
    "level-up": "Level up!",
    "correct-answer": "Correct!",
    "wrong-answer": "Wrong answer",
    "try-again": "Try again",
    "quiz-completed": "Quiz completed",
    "get-started": "Get Started",
    "tap-to-continue": "Tap anywhere to continue",
    "theme": "Theme",
    "dark-mode": "Dark Mode",
    "light-mode": "Light Mode",
    "notifications": "Notifications",
    "sound": "Sound",
    "music": "Music",
    "vibration": "Vibration",
    "about": "About",
    "help": "Help & Support",
    "terms": "Terms & Conditions",
    "privacy": "Privacy Policy",
    "version": "Version",
    "teacher-dashboard": "Teacher Dashboard",
    "admin-dashboard": "Admin Dashboard",
    "student": "Student",
    "teacher": "Teacher",
    "admin": "Administrator",
    "create-quiz": "Create Quiz",
    "my-quizzes": "My Quizzes",
    "student-progress": "Student Progress",
    "analytics": "Analytics",
    "resources": "Learning Resources",
    "assignments": "Assignments"
  },
  amharic: {
    welcome: "ወደ ማስተር ማይንድስ እንኳን ደህና መጡ",
    settings: "ቅንብሮች",
    profile: "መገለጫ",
    language: "ቋንቋ",
    english: "እንግሊዘኛ",
    amharic: "አማርኛ",
    "afaan-oromoo": "አፋን ኦሮሞ",
    save: "አስቀምጥ",
    cancel: "ይቅር",
    quiz: "ጥያቄዎች",
    multiplayer: "በጋራ ጨዋታ",
    leaderboard: "የዕድገት ደረጃ",
    friends: "ጓደኞች",
    logout: "ውጣ",
    "daily-challenge": "የዕለት ፈተና",
    "level-up": "ደረጃ ዕድገት!",
    "correct-answer": "ትክክል!",
    "wrong-answer": "የተሳሳተ መልስ",
    "try-again": "እንደገና ሞክር",
    "quiz-completed": "ጥያቄዎች ተጠናቀቁ",
    "get-started": "ይጀምሩ",
    "tap-to-continue": "ለመቀጠል የትኛውም ቦታ ይንኩ",
    "theme": "ገጽታ",
    "dark-mode": "ጨለማ ሁነታ",
    "light-mode": "ብርሃን ሁነታ",
    "notifications": "ማሳወቂያዎች",
    "sound": "ድምፅ",
    "music": "ሙዚቃ",
    "vibration": "ማንቀጥቀጥ",
    "about": "ስለ እኛ",
    "help": "እገዛ እና ድጋፍ",
    "terms": "የአገልግሎት ውል",
    "privacy": "የግላዊነት ፖሊሲ",
    "version": "ስሪት",
    "teacher-dashboard": "የመምህር ዳሽቦርድ",
    "admin-dashboard": "የአስተዳዳሪ ዳሽቦርድ",
    "student": "ተማሪ",
    "teacher": "መምህር",
    "admin": "አስተዳዳሪ",
    "create-quiz": "ጥያቄዎችን ፍጠር",
    "my-quizzes": "የእኔ ጥያቄዎች",
    "student-progress": "የተማሪ እድገት",
    "analytics": "ትንታኔዎች",
    "resources": "የመማሪያ ግብአቶች",
    "assignments": "የቤት ስራዎች"
  },
  "afaan-oromoo": {
    welcome: "Master Minds tti baga nagaan dhuftan",
    settings: "Qindaa'ina",
    profile: "Eenyummaa",
    language: "Afaan",
    english: "Afaan Ingilizii",
    amharic: "Afaan Amaaraa",
    "afaan-oromoo": "Afaan Oromoo",
    save: "Olkaa'i",
    cancel: "Dhiisi",
    quiz: "Gaaffiilee",
    multiplayer: "Taphachiisaa",
    leaderboard: "Sadarkaa",
    friends: "Hiriyoota",
    logout: "Ba'i",
    "daily-challenge": "Qormaata Guyyaa",
    "level-up": "Sadarkaa ol baate!",
    "correct-answer": "Sirrii!",
    "wrong-answer": "Dogoggora",
    "try-again": "Irra deebi'i yaali",
    "quiz-completed": "Gaaffileen xumuramaniiru",
    "get-started": "Jalqabi",
    "tap-to-continue": "Iddoo kamittuu tuqi itti fufuuf",
    "theme": "Bifaaji'a",
    "dark-mode": "Bifa dukkana",
    "light-mode": "Bifa ifaa",
    "notifications": "Beeksisni",
    "sound": "Sagalee",
    "music": "Muuziqaa",
    "vibration": "Sochoosa",
    "about": "Waa'ee keenyaa",
    "help": "Gargaarsa",
    "terms": "Ulaagaalee",
    "privacy": "Imaammata",
    "version": "Gulaala",
    "teacher-dashboard": "Dashboardii Barsiisaa",
    "admin-dashboard": "Dashboardii Bulchiinsaa",
    "student": "Barataa",
    "teacher": "Barsiisaa",
    "admin": "Bulchaa",
    "create-quiz": "Gaaffilee Uumi",
    "my-quizzes": "Gaaffilee koo",
    "student-progress": "Fooya'ina Barataa",
    "analytics": "Xiinxala",
    "resources": "Meeshaalee Barnootaa",
    "assignments": "Hojii Manaa"
  },
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("english");
  
  const translate = (key: string): string => {
    return translations[language][key] || key;
  };
  
  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translate,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
