import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { Home, Store } from 'lucide-react';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import AvatarStore from '@/components/store/AvatarStore';
import { CurrencyProvider } from '@/context/CurrencyContext';

const StorePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  React.useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="minimal" showIcons={false} />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="glass border-b border-border/50 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <BackButton to="/" />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-display font-bold text-foreground">Avatar Store</h1>
                  <p className="text-xs text-muted-foreground">Customize your avatar with cool items</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <Home className="h-4 w-4 mr-2" />
                Menu
              </Button>
            </div>
          </div>
        </header>

        {/* Store Content */}
        <main className="container mx-auto px-4 py-6">
          <AvatarStore />
        </main>
      </div>
    </div>
  );
};

export default StorePage;
