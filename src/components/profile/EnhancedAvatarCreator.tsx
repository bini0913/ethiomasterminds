
import React, { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";

interface EnhancedAvatarCreatorProps {
  onSelect: (avatar: string) => void;
  selectedAvatar: string;
}

interface AvatarOption {
  id: string;
  emoji: string;
  name: string;
}

// Avatar customization options
const avatarStyles = {
  hairstyles: [
    { id: "hair-1", emoji: "👩‍🦱", name: "Curly" },
    { id: "hair-2", emoji: "👩‍🦰", name: "Wavy" },
    { id: "hair-3", emoji: "👱‍♀️", name: "Blonde" },
    { id: "hair-4", emoji: "👩‍🦳", name: "White" },
    { id: "hair-5", emoji: "👨‍🦱", name: "Curly (M)" },
    { id: "hair-6", emoji: "👨‍🦰", name: "Red" }
  ],
  faces: [
    { id: "face-1", emoji: "😊", name: "Happy" },
    { id: "face-2", emoji: "😎", name: "Cool" },
    { id: "face-3", emoji: "🤓", name: "Nerd" },
    { id: "face-4", emoji: "😇", name: "Angel" },
    { id: "face-5", emoji: "🧐", name: "Curious" },
    { id: "face-6", emoji: "😌", name: "Peaceful" }
  ],
  outfits: [
    { id: "outfit-1", emoji: "👕", name: "T-Shirt" },
    { id: "outfit-2", emoji: "👚", name: "Blouse" },
    { id: "outfit-3", emoji: "👔", name: "Formal" },
    { id: "outfit-4", emoji: "🧥", name: "Coat" },
    { id: "outfit-5", emoji: "👗", name: "Dress" },
    { id: "outfit-6", emoji: "👘", name: "Kimono" }
  ],
  avatars: [
    { id: "avatar-1", emoji: "👦", name: "Boy" },
    { id: "avatar-2", emoji: "👧", name: "Girl" },
    { id: "avatar-3", emoji: "🧑", name: "Person" },
    { id: "avatar-4", emoji: "👩‍🎓", name: "Student" },
    { id: "avatar-5", emoji: "🧠", name: "Brain" },
    { id: "avatar-6", emoji: "🦸", name: "Superhero" }
  ],
  premium: [
    { id: "premium-1", emoji: "🦄", name: "Unicorn" },
    { id: "premium-2", emoji: "🐉", name: "Dragon" },
    { id: "premium-3", emoji: "👑", name: "Royal" },
    { id: "premium-4", emoji: "🥇", name: "Champion" },
    { id: "premium-5", emoji: "💎", name: "Diamond" },
    { id: "premium-6", emoji: "🌟", name: "Star" }
  ]
};

const EnhancedAvatarCreator: React.FC<EnhancedAvatarCreatorProps> = ({ onSelect, selectedAvatar }) => {
  const [currentTab, setCurrentTab] = useState<string>("avatars");
  
  // Function to render avatar options
  const renderAvatarOptions = (options: AvatarOption[]) => {
    return (
      <RadioGroup 
        value={selectedAvatar} 
        onValueChange={onSelect} 
        className="grid grid-cols-3 gap-4"
      >
        {options.map((option) => (
          <div key={option.id} className="flex flex-col items-center space-y-2">
            <Label
              htmlFor={option.id}
              className={`flex flex-col items-center justify-center h-20 w-20 rounded-xl border-2 cursor-pointer text-3xl transition-all ${
                selectedAvatar === option.id
                  ? "border-primary bg-primary-light"
                  : "border-gray-200 hover:border-primary-light"
              }`}
            >
              {option.emoji}
              <RadioGroupItem
                value={option.id}
                id={option.id}
                className="sr-only"
              />
            </Label>
            <span className="text-sm text-gray-700">{option.name}</span>
          </div>
        ))}
      </RadioGroup>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs 
        defaultValue="avatars" 
        value={currentTab}
        onValueChange={setCurrentTab}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full mb-4">
          <TabsTrigger value="avatars">Avatars</TabsTrigger>
          <TabsTrigger value="hairstyles">Hair</TabsTrigger>
          <TabsTrigger value="faces">Face</TabsTrigger>
          <TabsTrigger value="outfits">Outfits</TabsTrigger>
          <TabsTrigger value="premium">Premium</TabsTrigger>
        </TabsList>
        
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <TabsContent value="avatars" className="mt-4">
            {renderAvatarOptions(avatarStyles.avatars)}
          </TabsContent>
          
          <TabsContent value="hairstyles" className="mt-4">
            {renderAvatarOptions(avatarStyles.hairstyles)}
          </TabsContent>
          
          <TabsContent value="faces" className="mt-4">
            {renderAvatarOptions(avatarStyles.faces)}
          </TabsContent>
          
          <TabsContent value="outfits" className="mt-4">
            {renderAvatarOptions(avatarStyles.outfits)}
          </TabsContent>
          
          <TabsContent value="premium" className="mt-4">
            <div className="text-center mb-4">
              <h4 className="font-medium">Premium Avatars</h4>
              <p className="text-sm text-gray-500">Earn these special avatars by completing challenges and tournaments!</p>
            </div>
            {renderAvatarOptions(avatarStyles.premium)}
          </TabsContent>
        </motion.div>
      </Tabs>
      
      <div className="flex justify-center mt-6">
        <Button variant="outline" size="sm">
          Save Avatar
        </Button>
      </div>
    </div>
  );
};

export default EnhancedAvatarCreator;
