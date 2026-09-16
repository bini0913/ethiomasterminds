
import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface AvatarCreatorProps {
  onSelect: (avatar: string) => void;
  selectedAvatar: string;
}

const AvatarCreator: React.FC<AvatarCreatorProps> = ({ onSelect, selectedAvatar }) => {
  const avatars = [
    {
      id: "avatar-1",
      emoji: "👦",
      name: "Boy",
    },
    {
      id: "avatar-2",
      emoji: "👧",
      name: "Girl",
    },
    {
      id: "avatar-3",
      emoji: "🧑",
      name: "Person",
    },
    {
      id: "avatar-4",
      emoji: "👩‍🎓",
      name: "Student",
    },
    {
      id: "avatar-5",
      emoji: "🧠",
      name: "Brain",
    },
    {
      id: "avatar-6",
      emoji: "🦸",
      name: "Superhero",
    },
  ];

  return (
    <div className="space-y-4">
      <RadioGroup value={selectedAvatar} onValueChange={onSelect} className="grid grid-cols-3 gap-4">
        {avatars.map((avatar) => (
          <div key={avatar.id} className="flex flex-col items-center space-y-2">
            <Label
              htmlFor={avatar.id}
              className={`flex flex-col items-center justify-center h-20 w-20 rounded-xl border-2 cursor-pointer text-3xl transition-all ${
                selectedAvatar === avatar.id
                  ? "border-primary bg-primary-light"
                  : "border-gray-200 hover:border-primary-light"
              }`}
            >
              {avatar.emoji}
              <RadioGroupItem
                value={avatar.id}
                id={avatar.id}
                className="sr-only"
              />
            </Label>
            <span className="text-sm text-gray-700">{avatar.name}</span>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

export default AvatarCreator;
