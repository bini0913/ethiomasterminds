
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "@/context/UserContext";
import AvatarCreator from "./AvatarCreator";
import { motion } from "framer-motion";

interface ProfileSetupProps {
  onComplete: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete }) => {
  const { user, updateProfile } = useUser();
  const [gender, setGender] = useState("");
  const [grade, setGrade] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [avatar, setAvatar] = useState("avatar-1");
  const [step, setStep] = useState(1);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      gender,
      grade,
      educationLevel,
      avatar
    });
    onComplete();
  };

  const goToNextStep = () => {
    setStep(step + 1);
  };

  const goToPreviousStep = () => {
    setStep(step - 1);
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
          <h1 className="text-2xl font-bold text-primary">Complete Your Profile</h1>
          <p className="text-gray-500">Let's set up your student profile</p>
        </div>

        <div className="flex justify-center mb-6">
          <div className="w-full max-w-xs">
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-center rounded-full h-10 w-10 ${
                      i === step
                        ? "bg-primary text-white"
                        : i < step
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {i < step ? "✓" : i}
                  </div>
                ))}
              </div>
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(step - 1) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={gender}
                  onValueChange={setGender}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="grade">Grade</Label>
                <Select
                  value={grade}
                  onValueChange={setGrade}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={`${i + 1}`}>
                        Grade {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="educationLevel">Education Level</Label>
                <Select
                  value={educationLevel}
                  onValueChange={setEducationLevel}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your education level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elementary">Elementary School</SelectItem>
                    <SelectItem value="middle">Middle School</SelectItem>
                    <SelectItem value="high">High School</SelectItem>
                    <SelectItem value="university">University</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                className="w-full bg-primary hover:bg-primary-dark"
                onClick={goToNextStep}
                disabled={!gender || !grade || !educationLevel}
              >
                Next
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="text-center mb-4">
                <h2 className="text-lg font-semibold">Create Your Avatar</h2>
                <p className="text-sm text-gray-500">Choose an avatar that represents you</p>
              </div>

              <AvatarCreator onSelect={setAvatar} selectedAvatar={avatar} />

              <div className="flex space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPreviousStep}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-dark"
                >
                  Complete Setup
                </Button>
              </div>
            </motion.div>
          )}
        </form>
      </div>
    </motion.div>
  );
};

export default ProfileSetup;
