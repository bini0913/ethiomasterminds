
import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/context/UserContext";
import { toast } from "sonner";
import { ArrowLeft, Globe, Volume2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import AvatarCreator from "@/components/profile/AvatarCreator";

const Settings: React.FC = () => {
  const { user, updateProfile } = useUser();
  const navigate = useNavigate();

  // Language settings
  const [language, setLanguage] = React.useState("english");
  
  // Sound settings
  const [sfxEnabled, setSfxEnabled] = React.useState(true);
  const [musicEnabled, setMusicEnabled] = React.useState(true);
  
  // Avatar settings
  const [selectedAvatar, setSelectedAvatar] = React.useState(user?.avatar || "avatar-1");

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    toast.success(`Language changed to ${value}`);
    // In a real app, this would update app language
  };

  const handleSoundChange = (type: 'sfx' | 'music', enabled: boolean) => {
    if (type === 'sfx') {
      setSfxEnabled(enabled);
    } else {
      setMusicEnabled(enabled);
    }
    toast.success(`${type === 'sfx' ? 'Sound effects' : 'Music'} ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleAvatarChange = (avatar: string) => {
    setSelectedAvatar(avatar);
  };

  const saveAvatarSettings = () => {
    updateProfile({ avatar: selectedAvatar });
    toast.success("Avatar updated successfully!");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary px-4 py-3 shadow-md">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/")}
            className="mr-2 text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">Settings</h1>
        </div>
      </header>

      <div className="container max-w-md mx-auto py-6 px-4">
        <Tabs defaultValue="language">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="language" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>Language</span>
            </TabsTrigger>
            <TabsTrigger value="sound" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <span>Sound</span>
            </TabsTrigger>
            <TabsTrigger value="avatar" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>Avatar</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="language" className="mt-4">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-4">Select Language</h2>
              <RadioGroup value={language} onValueChange={handleLanguageChange}>
                <div className="flex items-center space-x-2 mb-3">
                  <RadioGroupItem value="english" id="english" />
                  <Label htmlFor="english">English</Label>
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <RadioGroupItem value="amharic" id="amharic" />
                  <Label htmlFor="amharic">Amharic</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="afaan-oromoo" id="afaan-oromoo" />
                  <Label htmlFor="afaan-oromoo">Afaan Oromoo</Label>
                </div>
              </RadioGroup>
            </Card>
          </TabsContent>
          
          <TabsContent value="sound" className="mt-4">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-4">Sound Settings</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sfx">Sound Effects</Label>
                  <Switch 
                    id="sfx" 
                    checked={sfxEnabled} 
                    onCheckedChange={(checked) => handleSoundChange('sfx', checked)} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="music">Music</Label>
                  <Switch 
                    id="music" 
                    checked={musicEnabled} 
                    onCheckedChange={(checked) => handleSoundChange('music', checked)} 
                  />
                </div>
              </div>
            </Card>
          </TabsContent>
          
          <TabsContent value="avatar" className="mt-4">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-4">Customize Avatar</h2>
              <AvatarCreator 
                onSelect={handleAvatarChange}
                selectedAvatar={selectedAvatar}
              />
              <Button 
                onClick={saveAvatarSettings}
                className="w-full mt-4 bg-primary hover:bg-primary-dark"
              >
                Save Avatar
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
