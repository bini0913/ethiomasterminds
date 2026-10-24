import { Check, Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Theme } from "@/context/ThemeContext";

const THEME_OPTIONS: Array<{ value: Theme; label: string; swatch: string; icon?: typeof Sun }> = [
  { value: "light", label: "Light", swatch: "bg-white border border-slate-300", icon: Sun },
  { value: "dark", label: "Dark", swatch: "bg-slate-900", icon: Moon },
  { value: "pink", label: "Pink", swatch: "bg-pink-400" },
  { value: "blue", label: "Blue", swatch: "bg-sky-500" },
];

const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Change theme" title="Change theme">
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)} className="flex items-center gap-2">
              <span className={`h-4 w-4 rounded-full ${option.swatch}`} aria-hidden />
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span className="flex-1">{option.label}</span>
              {theme === option.value ? <Check className="h-4 w-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;
