
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import AvatarCreator from "./AvatarCreator";
import { motion } from "framer-motion";

interface ProfileSetupProps {
  onComplete: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete }) => {
  const { user, updateProfile } = useUser();
  const { t } = useLanguage();
  const [gender, setGender] = useState("");
  const [grade, setGrade] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [avatar, setAvatar] = useState("avatar-1");
  const [step, setStep] = useState(1);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await updateProfile({ gender, grade, educationLevel, avatar });
    if (saved) onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary">{t("complete-profile")}</h1>
          <p className="text-gray-500">{t("setup-student-profile")}</p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="w-full max-w-xs">
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-center rounded-full h-10 w-10 ${
                      i === step ? "bg-primary text-white" : i < step ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {i < step ? "✓" : i}
                  </div>
                ))}
              </div>
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(step - 1) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div>
                <Label htmlFor="gender">{t("gender")}</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder={t("select-gender")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("male")}</SelectItem>
                    <SelectItem value="female">{t("female")}</SelectItem>
                    <SelectItem value="other">{t("other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="grade">{t("grade")}</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger><SelectValue placeholder={t("select-grade")} /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={`${i + 1}`}>{t("grade")} {i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="educationLevel">{t("education-level")}</Label>
                <Select value={educationLevel} onValueChange={setEducationLevel}>
                  <SelectTrigger><SelectValue placeholder={t("select-education")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elementary">{t("elementary")}</SelectItem>
                    <SelectItem value="middle">{t("middle")}</SelectItem>
                    <SelectItem value="high">{t("high")}</SelectItem>
                    <SelectItem value="university">{t("university")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="button" className="w-full bg-primary hover:bg-primary-dark" onClick={() => setStep(2)} disabled={!gender || !grade || !educationLevel}>
                {t("next")}
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-lg font-semibold">{t("create-avatar")}</h2>
                <p className="text-sm text-gray-500">{t("choose-avatar-desc")}</p>
              </div>
              <AvatarCreator onSelect={setAvatar} selectedAvatar={avatar} />
              <div className="flex space-x-4 pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">{t("back")}</Button>
                <Button type="submit" className="flex-1 bg-primary hover:bg-primary-dark">{t("complete-setup")}</Button>
              </div>
            </motion.div>
          )}
        </form>
      </div>
    </motion.div>
  );
};

export default ProfileSetup;
