import { useEffect, useState } from 'react';
import { Crown, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  feature: string;
  onClose: () => void;
}

export default function PremiumLockModal({ feature, onClose }: Props) {
  const [plans, setPlans] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('premium_plans').select('*').eq('active', true).order('duration_days').then(({ data }) => setPlans(data || []));
  }, []);

  const features = [
    'Set your profile picture',
    'Upload HD photos & videos',
    'Get gold premium badge',
    'Custom profile themes',
    'Animated usernames',
    'Premium emojis',
    'Story music',
    'Custom bio styles',
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="relative max-w-md w-full bg-gradient-to-br from-yellow-900/40 via-card to-card border border-yellow-500/30 rounded-2xl p-6 shadow-[0_0_60px_rgba(234,179,8,0.3)] animate-scale-in">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 text-muted-foreground">
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="absolute inset-0 rounded-full bg-yellow-500/30 blur-xl animate-pulse" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.6)]">
              <Crown className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">Buy Premium to Unlock</h2>
          <p className="text-sm text-muted-foreground mt-1">{feature}</p>
        </div>

        <div className="mt-5 space-y-2">
          {features.map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-foreground/90">
              <Check className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {plans.map(p => (
            <div key={p.id} className="bg-secondary/50 border border-yellow-500/20 rounded-xl p-3 text-center hover:border-yellow-500/50 transition cursor-pointer">
              <p className="text-xs text-muted-foreground">{p.name}</p>
              <p className="text-lg font-bold text-yellow-400">₹{p.price_inr}</p>
            </div>
          ))}
        </div>

        <Button className="w-full mt-5 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-semibold rounded-xl">
          <Crown className="w-4 h-4 mr-2" /> Upgrade to Premium
        </Button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">Contact admin to activate manually</p>
      </div>
    </div>
  );
}
