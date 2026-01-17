import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import SVGAvatarRenderer, { SVGAvatarConfig } from './SVGAvatarRenderer';
import { User, Paintbrush, Shirt, Sparkles, RotateCcw, Save, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarCustomizerProps {
  initialConfig?: Partial<SVGAvatarConfig>;
  userLevel?: number;
  unlockedItems?: string[];
  onSave: (config: SVGAvatarConfig) => void;
}

const defaultConfig: SVGAvatarConfig = {
  skinTone: 'medium',
  hairStyle: 'short',
  hairColor: 'brown',
  eyeStyle: 'round',
  eyeColor: 'brown',
  mouthStyle: 'smile',
  outfit: 'tshirt',
  outfitColor: 'blue',
  accessory: 'none',
  background: 'sky',
  faceShape: 'oval'
};

const options = {
  skinTone: [
    { id: 'light', label: 'Light', level: 1 },
    { id: 'fair', label: 'Fair', level: 1 },
    { id: 'medium', label: 'Medium', level: 1 },
    { id: 'tan', label: 'Tan', level: 1 },
    { id: 'brown', label: 'Brown', level: 1 },
    { id: 'dark', label: 'Dark', level: 1 }
  ],
  hairStyle: [
    { id: 'short', label: 'Short', level: 1 },
    { id: 'long', label: 'Long', level: 1 },
    { id: 'spiky', label: 'Spiky', level: 3 },
    { id: 'curly', label: 'Curly', level: 2 },
    { id: 'mohawk', label: 'Mohawk', level: 5 },
    { id: 'bald', label: 'Bald', level: 1 },
    { id: 'ponytail', label: 'Ponytail', level: 4 },
    { id: 'braids', label: 'Braids', level: 6 }
  ],
  hairColor: [
    { id: 'black', label: 'Black', level: 1 },
    { id: 'brown', label: 'Brown', level: 1 },
    { id: 'blonde', label: 'Blonde', level: 1 },
    { id: 'red', label: 'Red', level: 2 },
    { id: 'gray', label: 'Gray', level: 3 },
    { id: 'blue', label: 'Blue', level: 8 },
    { id: 'pink', label: 'Pink', level: 10 },
    { id: 'purple', label: 'Purple', level: 12 }
  ],
  eyeStyle: [
    { id: 'round', label: 'Round', level: 1 },
    { id: 'almond', label: 'Almond', level: 1 },
    { id: 'sleepy', label: 'Sleepy', level: 3 },
    { id: 'wink', label: 'Wink', level: 5 },
    { id: 'surprised', label: 'Surprised', level: 4 }
  ],
  eyeColor: [
    { id: 'brown', label: 'Brown', level: 1 },
    { id: 'blue', label: 'Blue', level: 1 },
    { id: 'green', label: 'Green', level: 1 },
    { id: 'gray', label: 'Gray', level: 2 },
    { id: 'hazel', label: 'Hazel', level: 2 }
  ],
  mouthStyle: [
    { id: 'smile', label: 'Smile', level: 1 },
    { id: 'grin', label: 'Grin', level: 2 },
    { id: 'neutral', label: 'Neutral', level: 1 },
    { id: 'open', label: 'Open', level: 3 },
    { id: 'smirk', label: 'Smirk', level: 4 }
  ],
  outfit: [
    { id: 'tshirt', label: 'T-Shirt', level: 1 },
    { id: 'hoodie', label: 'Hoodie', level: 3 },
    { id: 'suit', label: 'Suit', level: 8 },
    { id: 'dress', label: 'Dress', level: 5 },
    { id: 'sporty', label: 'Sporty', level: 4 }
  ],
  outfitColor: [
    { id: 'blue', label: 'Blue', level: 1 },
    { id: 'red', label: 'Red', level: 1 },
    { id: 'green', label: 'Green', level: 1 },
    { id: 'purple', label: 'Purple', level: 2 },
    { id: 'orange', label: 'Orange', level: 2 },
    { id: 'pink', label: 'Pink', level: 3 },
    { id: 'teal', label: 'Teal', level: 4 },
    { id: 'yellow', label: 'Yellow', level: 5 }
  ],
  accessory: [
    { id: 'none', label: 'None', level: 1 },
    { id: 'glasses', label: 'Glasses', level: 2 },
    { id: 'sunglasses', label: 'Sunglasses', level: 4 },
    { id: 'headphones', label: 'Headphones', level: 6 },
    { id: 'cap', label: 'Cap', level: 5 },
    { id: 'crown', label: 'Crown', level: 15 },
    { id: 'earrings', label: 'Earrings', level: 7 }
  ],
  background: [
    { id: 'sky', label: 'Sky', level: 1 },
    { id: 'sunset', label: 'Sunset', level: 2 },
    { id: 'forest', label: 'Forest', level: 3 },
    { id: 'ocean', label: 'Ocean', level: 4 },
    { id: 'galaxy', label: 'Galaxy', level: 8 },
    { id: 'fire', label: 'Fire', level: 6 },
    { id: 'mint', label: 'Mint', level: 5 },
    { id: 'rose', label: 'Rose', level: 7 }
  ]
};

const colorPreview: Record<string, string> = {
  light: '#FFDBB4', fair: '#F5D0C5', medium: '#D4A574', tan: '#C68642', brown: '#8D5524', dark: '#5C3317',
  black: '#1C1C1C', blonde: '#D4A574', red: '#8B4513', gray: '#808080', blue: '#4169E1', pink: '#FF69B4', purple: '#8B5CF6',
  green: '#22C55E', orange: '#F97316', teal: '#14B8A6', yellow: '#EAB308', hazel: '#8B7355'
};

const AvatarCustomizer: React.FC<AvatarCustomizerProps> = ({
  initialConfig,
  userLevel = 1,
  unlockedItems = [],
  onSave
}) => {
  const [config, setConfig] = useState<SVGAvatarConfig>({ ...defaultConfig, ...initialConfig });

  const updateConfig = (key: keyof SVGAvatarConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const isUnlocked = (optionId: string, requiredLevel: number) => {
    return userLevel >= requiredLevel || unlockedItems.includes(optionId);
  };

  const handleReset = () => {
    setConfig(defaultConfig);
  };

  const handleSave = () => {
    onSave(config);
  };

  const renderOptionGrid = (
    optionKey: keyof typeof options,
    configKey: keyof SVGAvatarConfig
  ) => (
    <div className="grid grid-cols-4 gap-2">
      {options[optionKey].map((option) => {
        const unlocked = isUnlocked(option.id, option.level);
        const selected = config[configKey] === option.id;
        const hasColor = colorPreview[option.id];

        return (
          <button
            key={option.id}
            onClick={() => unlocked && updateConfig(configKey, option.id)}
            disabled={!unlocked}
            className={cn(
              'relative p-2 rounded-lg border-2 transition-all text-xs font-medium',
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : unlocked
                ? 'border-border hover:border-primary/50 bg-card'
                : 'border-border/50 bg-muted/30 opacity-60 cursor-not-allowed'
            )}
          >
            {hasColor && (
              <div
                className="w-6 h-6 rounded-full mx-auto mb-1 border border-border"
                style={{ backgroundColor: hasColor }}
              />
            )}
            <span className="block truncate">{option.label}</span>
            {!unlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                <div className="text-center">
                  <Lock className="h-3 w-3 mx-auto text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Lv.{option.level}</span>
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <Card className="glass border-border/30">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Avatar Customizer
          </CardTitle>
          <Badge variant="outline">Level {userLevel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview */}
        <div className="flex justify-center">
          <div className="relative">
            <SVGAvatarRenderer config={config} size="xl" />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">Preview</Badge>
            </div>
          </div>
        </div>

        {/* Customization Tabs */}
        <Tabs defaultValue="face" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="face" className="flex-col py-2">
              <User className="h-4 w-4 mb-1" />
              <span className="text-xs">Face</span>
            </TabsTrigger>
            <TabsTrigger value="hair" className="flex-col py-2">
              <Paintbrush className="h-4 w-4 mb-1" />
              <span className="text-xs">Hair</span>
            </TabsTrigger>
            <TabsTrigger value="outfit" className="flex-col py-2">
              <Shirt className="h-4 w-4 mb-1" />
              <span className="text-xs">Outfit</span>
            </TabsTrigger>
            <TabsTrigger value="extras" className="flex-col py-2">
              <Sparkles className="h-4 w-4 mb-1" />
              <span className="text-xs">Extras</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px] mt-4">
            <TabsContent value="face" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium mb-2">Skin Tone</h4>
                {renderOptionGrid('skinTone', 'skinTone')}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Eye Style</h4>
                {renderOptionGrid('eyeStyle', 'eyeStyle')}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Eye Color</h4>
                {renderOptionGrid('eyeColor', 'eyeColor')}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Mouth</h4>
                {renderOptionGrid('mouthStyle', 'mouthStyle')}
              </div>
            </TabsContent>

            <TabsContent value="hair" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium mb-2">Hair Style</h4>
                {renderOptionGrid('hairStyle', 'hairStyle')}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Hair Color</h4>
                {renderOptionGrid('hairColor', 'hairColor')}
              </div>
            </TabsContent>

            <TabsContent value="outfit" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium mb-2">Outfit</h4>
                {renderOptionGrid('outfit', 'outfit')}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Outfit Color</h4>
                {renderOptionGrid('outfitColor', 'outfitColor')}
              </div>
            </TabsContent>

            <TabsContent value="extras" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium mb-2">Accessory</h4>
                {renderOptionGrid('accessory', 'accessory')}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Background</h4>
                {renderOptionGrid('background', 'background')}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save Avatar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AvatarCustomizer;
