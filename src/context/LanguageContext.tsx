
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
    welcome: "Welcome to Master Minds",
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
