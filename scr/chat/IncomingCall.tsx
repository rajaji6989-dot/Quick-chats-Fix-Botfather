import { Phone, PhoneOff, Video } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { updateCallStatus } from '@/lib/calls';

interface IncomingCallProps {
  call: any;
  callerProfile: any;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCall({ call, callerProfile, onAccept, onReject }: IncomingCallProps) {
  const handleReject = async () => {
    await updateCallStatus(call.id, 'rejected');
    onReject();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-8 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
          <Avatar className="w-28 h-28 relative border-4 border-primary/30">
            {callerProfile?.avatar_url && <AvatarImage src={callerProfile.avatar_url} />}
            <AvatarFallback className="bg-primary/20 text-primary text-4xl font-bold">
              {callerProfile?.username?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-foreground">@{callerProfile?.username}</p>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 justify-center">
            {call.call_type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            Incoming {call.call_type} call...
          </p>
        </div>
      </div>

      <div className="flex items-center gap-12">
        <button
          onClick={handleReject}
          className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground shadow-lg active:scale-95 transition-transform"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
        <button
          onClick={onAccept}
          className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg active:scale-95 transition-transform"
        >
          <Phone className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}
