import { useState } from 'react';
import { Lock, ArrowLeft, Delete } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PinSetupProps {
  onClose: () => void;
  onSet: () => void;
}

export default function PinSetup({ onClose, onSet }: PinSetupProps) {
  const [step, setStep] = useState<'set' | 'confirm'>('set');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState(false);
  const { toast } = useToast();

  const existingPin = localStorage.getItem('quickchat_pin');

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === 4) {
        setTimeout(() => {
          if (step === 'set') {
            setFirstPin(newPin);
            setStep('confirm');
            setPin('');
          } else {
            if (newPin === firstPin) {
              localStorage.setItem('quickchat_pin', newPin);
              toast({ title: 'PIN set successfully! 🔒' });
              onSet();
              onClose();
            } else {
              setError(true);
              setTimeout(() => {
                setPin('');
                setError(false);
              }, 500);
            }
          }
        }, 200);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleRemovePin = () => {
    localStorage.removeItem('quickchat_pin');
    toast({ title: 'PIN removed 🔓' });
    onSet();
    onClose();
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
      }`}
    />
  ));

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center gap-4 px-4 py-3 bg-chat-header border-b border-border">
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">
          {existingPin ? 'Change PIN' : 'Set PIN Lock'}
        </h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-10">
        <div className="flex flex-col items-center gap-4">
          <Lock className="w-10 h-10 text-primary" />
          <p className="text-sm text-muted-foreground">
            {step === 'set' ? 'Enter a 4-digit PIN' : 'Confirm your PIN'}
          </p>
        </div>

        <div className="flex gap-5">{dots}</div>

        <div className="grid grid-cols-3 gap-4 w-64">
          {keys.map((key, i) => {
            if (key === '') return <div key={i} />;
            if (key === 'del') {
              return (
                <button key={i} onClick={handleDelete}
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary active:scale-95 transition-all">
                  <Delete className="w-6 h-6" />
                </button>
              );
            }
            return (
              <button key={i} onClick={() => handlePress(key)}
                className="w-16 h-16 mx-auto rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground text-xl font-medium active:scale-95 transition-all">
                {key}
              </button>
            );
          })}
        </div>

        {existingPin && (
          <button
            onClick={handleRemovePin}
            className="text-destructive text-sm hover:underline mt-4"
          >
            Remove PIN Lock
          </button>
        )}
      </div>
    </div>
  );
}
