import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { ChevronLeft, Languages, Volume2, Bell, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";

const Settings: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  
  const [volume, setVolume] = React.useState(70);
  const [notifications, setNotifications] = React.useState(true);
  const [soundEffects, setSoundEffects] = React.useState(true);
  const [vibration, setVibration] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(false);
  
  const handleLanguageChange = (value: string) => {
    setLanguage(value as "english" | "amharic" | "afaan-oromoo");
    toast.success(`${t("language")} ${t("settings")} ${t("save")}`);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary px-4 py-3 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/")}
              className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-white">{t("settings")}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/enhanced-settings")}
            className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
          >
            <UserCircle className="h-4 w-4 mr-2" />
            Avatar Editor
          </Button>
        </div>
      </header>

      <div className="container max-w-md mx-auto py-6 px-4">
        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sound">Sound</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="h-5 w-5" />
                  {t("language")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={language} onValueChange={handleLanguageChange} className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="english" id="english" />
                    <Label htmlFor="english">{t("english")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="amharic" id="amharic" />
                    <Label htmlFor="amharic">{t("amharic")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="afaan-oromoo" id="afaan-oromoo" />
                    <Label htmlFor="afaan-oromoo">{t("afaan-oromoo")}</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Display</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <Switch
                    id="dark-mode"
                    checked={darkMode}
                    onCheckedChange={setDarkMode}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="sound" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Sound
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="volume">Volume</Label>
                    <span>{volume}%</span>
                  </div>
                  <Slider
                    id="volume"
                    min={0}
                    max={100}
                    step={1}
                    value={[volume]}
                    onValueChange={(value) => setVolume(value[0])}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="sound-effects">Sound Effects</Label>
                  <Switch
                    id="sound-effects"
                    checked={soundEffects}
                    onCheckedChange={setSoundEffects}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="vibration">Vibration</Label>
                  <Switch
                    id="vibration"
                    checked={vibration}
                    onCheckedChange={setVibration}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="notifications" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notifications">Enable Notifications</Label>
                  <Switch
                    id="notifications"
                    checked={notifications}
                    onCheckedChange={setNotifications}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Notification Types</Label>
                  <div className="space-y-2 pl-2 pt-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="friend-requests">Friend Requests</Label>
                      <Switch id="friend-requests" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="messages">Messages</Label>
                      <Switch id="messages" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="game-invites">Game Invites</Label>
                      <Switch id="game-invites" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="daily-quiz">Daily Quiz</Label>
                      <Switch id="daily-quiz" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
