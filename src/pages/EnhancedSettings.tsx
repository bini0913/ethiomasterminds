import React, { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  User, 
  Globe, 
  Bell, 
  Shield, 
  Palette,
  Volume2,
  Eye,
  LogOut,
  Save,
  Trash2,
  Download,
  UserCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import SimpleAvatarEditor, { SimpleAvatarConfig } from '@/components/avatar/SimpleAvatarEditor';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { getMindForgeSettings, saveMindForgeSettings } from '@/lib/mindforge';

import { AvatarConfig } from '@/context/UserContext';

const EnhancedSettings: React.FC = () => {
  const { user, logout, updateProfile } = useUser();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const mindForge = getMindForgeSettings();

  const [settings, setSettings] = useState({
    notifications: true,
    soundEffects: mindForge.soundEnabled,
    autoSave: true,
    showAvatar: true,
    showRank: true,
    allowFriendRequests: true,
    showOnlineStatus: true,
    difficulty: 'medium',
    language: language,
    theme: 'default',
    reactionAnimations: mindForge.reactionsEnabled,
    reducedMotion: mindForge.reducedMotion
  });

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    grade: user?.grade || '',
    bio: ''
  });

  const [avatarConfig, setAvatarConfig] = useState<Partial<SimpleAvatarConfig>>({});
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);


  useEffect(() => {
    saveMindForgeSettings({
      reactionsEnabled: settings.reactionAnimations,
      soundEnabled: settings.soundEffects,
      reducedMotion: settings.reducedMotion
    });
  }, [settings.reactionAnimations, settings.soundEffects, settings.reducedMotion]);

  // Load user's avatar config from database
  useEffect(() => {
    if (user?.avatarConfig) {
      setAvatarConfig(user.avatarConfig);
    }
  }, [user?.avatarConfig]);

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileData.name,
          grade: profileData.grade
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update local user state
      if (updateProfile) {
        updateProfile({ name: profileData.name, grade: profileData.grade });
      }

      toast.success("Profile saved successfully!");
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error("Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAvatar = async (config: SimpleAvatarConfig) => {
    if (!user?.id) return;
    
    setSavingAvatar(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_config: config as unknown as Json })
        .eq('id', user.id);

      if (error) throw error;

      // Update local user state
      if (updateProfile) {
        updateProfile({ avatarConfig: config as any });
      }

      setAvatarConfig(config);
      toast.success("Avatar saved successfully!");
    } catch (err) {
      console.error('Error saving avatar:', err);
      toast.error("Failed to save avatar");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleLanguageChange = (newLanguage: "english" | "amharic" | "afaan-oromoo") => {
    setLanguage(newLanguage);
    handleSettingChange('language', newLanguage);
    const displayName = newLanguage === "english" ? "English" : newLanguage === "amharic" ? "Amharic" : "Afaan Oromoo";
    toast.success(`Language changed to ${displayName}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleDeleteAccount = () => {
    toast.error("Account deletion requires confirmation. Contact support for assistance.");
  };

  const handleExportData = async () => {
    if (!user?.id) return;

    try {
      // Fetch user data
      const [profileRes, resultsRes, achievementsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('quiz_results').select('*').eq('student_id', user.id),
        supabase.from('user_achievements').select('*').eq('user_id', user.id)
      ]);

      const exportData = {
        profile: profileRes.data,
        quizResults: resultsRes.data,
        achievements: achievementsRes.data,
        exportedAt: new Date().toISOString()
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `masterminds-data-${user.id}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully!");
    } catch (err) {
      console.error('Error exporting data:', err);
      toast.error("Failed to export data");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="minimal" showIcons={false} />
      
      <div className="relative z-10">
        <header className="glass border-b border-border/50 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <BackButton to="/" />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-display font-bold text-foreground">Settings</h1>
                  <p className="text-xs text-muted-foreground">Customize your experience</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="container max-w-4xl mx-auto py-6 px-4">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 glass border-border/30">
              <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <User className="h-4 w-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="avatar" className="data-[state=active]:bg-accent data-[state=active]:text-white">
                <UserCircle className="h-4 w-4 mr-2" />
                Avatar
              </TabsTrigger>
              <TabsTrigger value="general" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
                <Settings className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="language" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Globe className="h-4 w-4 mr-2" />
                Language
              </TabsTrigger>
            </TabsList>
            
            {/* Avatar Tab */}
            <TabsContent value="avatar">
              <Card className="glass border-border/50">
                <CardContent className="p-6">
                  <SimpleAvatarEditor 
                    initialConfig={avatarConfig as Partial<SimpleAvatarConfig>}
                    userLevel={user?.level || 1}
                    onSave={handleSaveAvatar}
                  />
                </CardContent>
              </Card>
              {savingAvatar && (
                <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
                  <div className="flex items-center gap-2 bg-card p-4 rounded-lg shadow-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Saving avatar...</span>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                    placeholder="Your display name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                    placeholder="your.email@example.com"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade Level</Label>
                  <Select value={profileData.grade} onValueChange={(value) => setProfileData({...profileData, grade: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                        <SelectItem key={grade} value={grade.toString()}>
                          Grade {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <div className="flex items-center">
                    <Badge variant="secondary" className="capitalize">
                      {user?.role || 'Student'}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Bio (Optional)</Label>
                <Input
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                  placeholder="Tell others about yourself..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleSaveProfile} className="w-full" disabled={savingProfile}>
                {savingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Profile
              </Button>
              <Button onClick={handleExportData} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
              <Button onClick={handleLogout} variant="outline" className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* App Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive quiz reminders and updates</p>
                </div>
                <Switch
                  id="notifications"
                  checked={settings.notifications}
                  onCheckedChange={(checked) => handleSettingChange('notifications', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sound">Sound Effects</Label>
                  <p className="text-sm text-muted-foreground">Play sounds during quizzes</p>
                </div>
                <Switch
                  id="sound"
                  checked={settings.soundEffects}
                  onCheckedChange={(checked) => handleSettingChange('soundEffects', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="mindforge-reactions">MindForge Reactions™</Label>
                  <p className="text-sm text-muted-foreground">Show cinematic answer reactions</p>
                </div>
                <Switch
                  id="mindforge-reactions"
                  checked={settings.reactionAnimations}
                  onCheckedChange={(checked) => handleSettingChange('reactionAnimations', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="reduced-motion">Reduced Motion Mode</Label>
                  <p className="text-sm text-muted-foreground">Limit movement-heavy effects for accessibility</p>
                </div>
                <Switch
                  id="reduced-motion"
                  checked={settings.reducedMotion}
                  onCheckedChange={(checked) => handleSettingChange('reducedMotion', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autosave">Auto-save Progress</Label>
                  <p className="text-sm text-muted-foreground">Automatically save quiz progress</p>
                </div>
                <Switch
                  id="autosave"
                  checked={settings.autoSave}
                  onCheckedChange={(checked) => handleSettingChange('autoSave', checked)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Default Difficulty</Label>
                <Select value={settings.difficulty} onValueChange={(value) => handleSettingChange('difficulty', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Display
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-avatar">Show Avatar</Label>
                  <p className="text-sm text-muted-foreground">Display your avatar to others</p>
                </div>
                <Switch
                  id="show-avatar"
                  checked={settings.showAvatar}
                  onCheckedChange={(checked) => handleSettingChange('showAvatar', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-rank">Show Rank</Label>
                  <p className="text-sm text-muted-foreground">Display your rank publicly</p>
                </div>
                <Switch
                  id="show-rank"
                  checked={settings.showRank}
                  onCheckedChange={(checked) => handleSettingChange('showRank', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="friend-requests">Allow Friend Requests</Label>
                  <p className="text-sm text-muted-foreground">Let others send you friend requests</p>
                </div>
                <Switch
                  id="friend-requests"
                  checked={settings.allowFriendRequests}
                  onCheckedChange={(checked) => handleSettingChange('allowFriendRequests', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="online-status">Show Online Status</Label>
                  <p className="text-sm text-muted-foreground">Let friends see when you're online</p>
                </div>
                <Switch
                  id="online-status"
                  checked={settings.showOnlineStatus}
                  onCheckedChange={(checked) => handleSettingChange('showOnlineStatus', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Language & Appearance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Language & Region
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Interface Language</Label>
                <Select value={language} onValueChange={handleLanguageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">🇺🇸 English</SelectItem>
                    <SelectItem value="amharic">🇪🇹 Amharic (አማርኛ)</SelectItem>
                    <SelectItem value="afaan-oromoo">🇪🇹 Afaan Oromoo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>App Theme</Label>
                <Select value={settings.theme} onValueChange={(value) => handleSettingChange('theme', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="colorful">Colorful</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Danger Zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-destructive/10 rounded-lg">
              <h4 className="font-medium text-destructive mb-2">Delete Account</h4>
              <p className="text-sm text-muted-foreground mb-3">
                This action cannot be undone. All your progress, achievements, and data will be permanently deleted.
              </p>
              <Button onClick={handleDeleteAccount} variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
            </TabsContent>
            
            {/* General Tab */}
            <TabsContent value="general" className="space-y-6">
              <Card className="glass border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    General Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notifications2">Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive quiz reminders and updates</p>
                    </div>
                    <Switch
                      id="notifications2"
                      checked={settings.notifications}
                      onCheckedChange={(checked) => handleSettingChange('notifications', checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="sound2">Sound Effects</Label>
                      <p className="text-sm text-muted-foreground">Play sounds during quizzes</p>
                    </div>
                    <Switch
                      id="sound2"
                      checked={settings.soundEffects}
                      onCheckedChange={(checked) => handleSettingChange('soundEffects', checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="mindforge2">MindForge Reactions™</Label>
                      <p className="text-sm text-muted-foreground">Cinematic correct/wrong overlays during quiz</p>
                    </div>
                    <Switch
                      id="mindforge2"
                      checked={settings.reactionAnimations}
                      onCheckedChange={(checked) => handleSettingChange('reactionAnimations', checked)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="reduced-motion2">Reduced Motion</Label>
                      <p className="text-sm text-muted-foreground">Lower animation intensity</p>
                    </div>
                    <Switch
                      id="reduced-motion2"
                      checked={settings.reducedMotion}
                      onCheckedChange={(checked) => handleSettingChange('reducedMotion', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Language Tab */}
            <TabsContent value="language" className="space-y-6">
              <Card className="glass border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Language & Region
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Interface Language</Label>
                    <Select value={language} onValueChange={handleLanguageChange}>
                      <SelectTrigger className="glass border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">🇺🇸 English</SelectItem>
                        <SelectItem value="amharic">🇪🇹 Amharic (አማርኛ)</SelectItem>
                        <SelectItem value="afaan-oromoo">🇪🇹 Afaan Oromoo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default EnhancedSettings;
