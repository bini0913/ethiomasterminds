import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import BackButton from '@/components/ui/BackButton';
import CurrencyDisplay from '@/components/currency/CurrencyDisplay';
import { Settings, LogOut, Bell, Home } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconGradient?: string;
  showBack?: boolean;
  showHome?: boolean;
  showCurrency?: boolean;
  showSettings?: boolean;
  showNotifications?: boolean;
  backTo?: string;
  children?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  icon,
  iconGradient = "from-primary to-accent",
  showBack = true,
  showHome = true,
  showCurrency = false,
  showSettings = true,
  showNotifications = false,
  backTo,
  children
}) => {
  const { logout } = useUser();
  const navigate = useNavigate();

  return (
    <header className="glass border-b border-border/50 sticky top-0 z-20">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side: Back button + Title */}
          <div className="flex items-center gap-3">
            {showBack && (
              <div className="flex items-center gap-1">
                <BackButton to={backTo} />
                {showHome && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate('/')}
                    className="h-10 w-10 rounded-xl"
                    title="Go to Menu"
                  >
                    <Home className="h-5 w-5" />
                  </Button>
                )}
              </div>
            )}
            {icon && (
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center`}>
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-lg font-display font-bold text-foreground">{title}</h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right side: Actions */}
          <div className="flex items-center gap-2">
            {children}
            {showCurrency && <CurrencyDisplay showBoth />}
            {showNotifications && (
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Bell className="h-5 w-5" />
              </Button>
            )}
            {showSettings && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/settings')}
                className="h-9 w-9"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={logout}
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
