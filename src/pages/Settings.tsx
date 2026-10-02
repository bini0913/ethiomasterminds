import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { 
  ChevronLeft, Languages, Volume2, Bell, UserCircle, 
  Palette, Shield, Info, LogOut, Trash2,
  Smartphone, Globe, Lock, Eye, EyeOff
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import BackButton from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const HOME_ONBOARDING_STORAGE_KEY = "home_onboarding_completed_v1";

const Settings: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  
  const [volume, setVolume] = useState(70);
  const [notifications, setNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [vibration, setVibration] = useState(true);
  
  const [showPassword, setShowPassword] = useState(false);
  
  const handleLanguageChange = (value: string) => {
    setLanguage(value as "english" | "amharic" | "afaan-oromoo");
    toast.success(`Language changed to ${value}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleReplayTutorial = async () => {
    localStorage.removeItem(HOME_ONBOARDING_STORAGE_KEY);
    if (user?.id) {
      await supabase.from("user_onboarding_states" as any).upsert({
        user_id: user.id,
        home_completed: false,
        updated_at: new Date().toISOString(),
      });
    }
    toast.success("Tutorial reset. Return to Home to replay it.");
  };

  const settingsSections = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'sound', label: 'Sound', icon: Volume2 },
    { id: 'notifications', label: 'Alerts', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ];
  
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gradient">{t("settings")}</h1>
              <p className="text-sm text-muted-foreground">Customize your experience</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/enhanced-settings")}
            className="border-primary/50 text-primary hover:bg-primary/10"
          >
            <UserCircle className="h-4 w-4 mr-2" />
            Avatar Editor
          </Button>
        </div>
      </header>

      <div className="container max-w-4xl mx-auto py-8 px-4 relative z-10">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="glass grid w-full grid-cols-4 p-1">
            {settingsSections.map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <section.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{section.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          
          {/* General Settings */}
          <TabsContent value="general">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Language */}
              <Card className="glass neon-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Languages className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <span className="text-foreground">{t("language")}</span>
                      <p className="text-sm text-muted-foreground font-normal">Choose your preferred language</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={language} onValueChange={handleLanguageChange} className="space-y-3">
                    {[
                      { value: 'english', label: 'English', flag: '🇬🇧' },
                      { value: 'amharic', label: 'አማርኛ (Amharic)', flag: '🇪🇹' },
                      { value: 'afaan-oromoo', label: 'Afaan Oromoo', flag: '🇪🇹' },
                    ].map((lang) => (
                      <motion.div 
                        key={lang.value}
                        whileHover={{ scale: 1.01 }}
                        className={`flex items-center space-x-3 p-4 rounded-xl border transition-all cursor-pointer ${
                          language === lang.value 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border/50 hover:border-primary/50'
                        }`}
                        onClick={() => handleLanguageChange(lang.value)}
                      >
                        <RadioGroupItem value={lang.value} id={lang.value} />
                        <span className="text-2xl">{lang.flag}</span>
                        <Label htmlFor={lang.value} className="text-foreground cursor-pointer flex-1">{lang.label}</Label>
                        {language === lang.value && (
                          <Badge className="bg-primary/20 text-primary border-0">Active</Badge>
                        )}
                      </motion.div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>

              <Card className="glass border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Tutorial</span>
                    <Button variant="outline" onClick={handleReplayTutorial}>
                      Replay Tutorial
                    </Button>
                  </CardTitle>
                </CardHeader>
              </Card>
              
            </motion.div>
          </TabsContent>
          
          {/* Sound Settings */}
          <TabsContent value="sound">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass neon-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                      <Volume2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-foreground">Sound Settings</span>
                      <p className="text-sm text-muted-foreground font-normal">Adjust audio preferences</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Volume Slider */}
                  <div className="space-y-4 p-4 rounded-xl border border-border/50">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="volume" className="text-foreground">Master Volume</Label>
                      <Badge variant="outline" className="font-mono">{volume}%</Badge>
                    </div>
                    <Slider
                      id="volume"
                      min={0}
                      max={100}
                      step={1}
                      value={[volume]}
                      onValueChange={(value) => setVolume(value[0])}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Mute</span>
                      <span>Max</span>
                    </div>
                  </div>
                  
                  {/* Sound Effects Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                    <div>
                      <Label htmlFor="sound-effects" className="text-foreground">Sound Effects</Label>
                      <p className="text-sm text-muted-foreground">UI sounds and game effects</p>
                    </div>
                    <Switch
                      id="sound-effects"
                      checked={soundEffects}
                      onCheckedChange={setSoundEffects}
                    />
                  </div>
                  
                  {/* Vibration Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor="vibration" className="text-foreground">Vibration</Label>
                        <p className="text-sm text-muted-foreground">Haptic feedback on actions</p>
                      </div>
                    </div>
                    <Switch
                      id="vibration"
                      checked={vibration}
                      onCheckedChange={setVibration}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
          
          {/* Notifications Settings */}
          <TabsContent value="notifications">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass neon-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                      <Bell className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-foreground">Notifications</span>
                      <p className="text-sm text-muted-foreground font-normal">Manage your alerts</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Master Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-primary/30 bg-primary/5">
                    <div>
                      <Label htmlFor="notifications" className="text-foreground font-medium">Enable All Notifications</Label>
                      <p className="text-sm text-muted-foreground">Master switch for all alerts</p>
                    </div>
                    <Switch
                      id="notifications"
                      checked={notifications}
                      onCheckedChange={setNotifications}
                    />
                  </div>
                  
                  <Button variant="outline" className="w-full" onClick={() => navigate("/notifications")}>
                    <Bell className="h-4 w-4 mr-2" />
                    Open notification settings
                  </Button>

                  {/* Individual Toggles */}
                  <div className="space-y-3 opacity-80" style={{ opacity: notifications ? 1 : 0.5 }}>
                    {[
                      { id: 'friend-requests', label: 'Friend Requests', desc: 'When someone adds you', default: true },
                      { id: 'messages', label: 'Messages', desc: 'New chat messages', default: true },
                      { id: 'game-invites', label: 'Game Invites', desc: 'Multiplayer invitations', default: true },
                      { id: 'daily-quiz', label: 'Daily Quiz Reminder', desc: 'Daily challenge notifications', default: false },
                      { id: 'achievements', label: 'Achievements', desc: 'When you unlock badges', default: true },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                        <div>
                          <Label htmlFor={item.id} className="text-foreground">{item.label}</Label>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                        <Switch id={item.id} defaultChecked={item.default} disabled={!notifications} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
          
          {/* Privacy Settings */}
          <TabsContent value="privacy">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card className="glass neon-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-foreground">Privacy & Security</span>
                      <p className="text-sm text-muted-foreground font-normal">Manage your privacy</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { id: 'profile-public', label: 'Public Profile', desc: 'Others can see your stats', default: true },
                    { id: 'online-status', label: 'Show Online Status', desc: 'Let friends see when you\'re online', default: true },
                    { id: 'activity-history', label: 'Activity History', desc: 'Track your learning progress', default: true },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50">
                      <div>
                        <Label htmlFor={item.id} className="text-foreground">{item.label}</Label>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch id={item.id} defaultChecked={item.default} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="glass border-destructive/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-destructive">
                    <Info className="h-5 w-5" />
                    Account Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-border/50 hover:bg-muted"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log Out
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* App Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          <p>Master Minds v1.0.0</p>
          <p className="mt-1">Created by Biniam Bogale</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Settings;
