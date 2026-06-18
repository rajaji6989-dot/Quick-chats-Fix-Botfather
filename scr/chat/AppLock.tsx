import { useState, useEffect } from 'react';
import { Lock, Delete } from 'lucide-react';

interface AppLockProps {
  onUnlock: () => void;
}

export default function AppLock({ onUnlock }: AppLockProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const storedPin = localStorage.getItem('quickchat_pin');

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === storedPin) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    }
  }, [pin, storedPin, onUnlock]);

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const dots = Array.from({ length: 4 }, (_, i) => (
    <div
      key={i}
      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
        error
          ? 'border-destructive bg-destructive'
          : i < pin.length
          ? 'border-primary bg-primary'
          : 'border-muted-foreground'
      } ${error ? 'animate-shake' : ''}`}
    />
  ));

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-10">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">QuickChat Locked</h2>
          <p className="text-sm text-muted-foreground mt-1">Enter your 4-digit PIN</p>
        </div>
      </div>

      <div className="flex gap-5">{dots}</div>

      <div className="grid grid-cols-3 gap-4 w-64">
        {keys.map((key, i) => {
          if (key === '') return <div key={i} />;
          if (key === 'del') {
            return (
              <button
                key={i}
                onClick={handleDelete}
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary active:scale-95 transition-all"
              >
                <Delete className="w-6 h-6" />
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => handlePress(key)}
              className="w-16 h-16 mx-auto rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground text-xl font-medium active:scale-95 transition-all"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
