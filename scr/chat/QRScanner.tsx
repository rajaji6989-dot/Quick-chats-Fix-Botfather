import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';
import { searchUsers } from '@/lib/auth';
import { sendChatRequest, checkExistingRequest } from '@/lib/requests';
import { getOrCreateConversation } from '@/lib/chat';
import { useToast } from '@/hooks/use-toast';

interface QRScannerProps {
  onClose: () => void;
  onStartChat: (convoId: string, user: any) => void;
}

export default function QRScanner({ onClose, onStartChat }: QRScannerProps) {
  const [processing, setProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const { toast } = useToast();

  // Wait for DOM element to be available
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const el = document.getElementById('qr-reader');
    if (!el) return;

    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        if (processingRef.current) return;
        
        // Accept legacy quickchat:user:<name> AND new https://quickchats.lovable.app/?u=<name>
        let username: string | null = null;
        const legacy = decodedText.match(/^quickchat:user:(.+)$/);
        if (legacy) {
          username = legacy[1];
        } else {
          try {
            const u = new URL(decodedText);
            const fromQuery = u.searchParams.get('u');
            if (fromQuery) username = fromQuery;
          } catch { /* not a URL */ }
        }
        if (!username) {
          toast({ title: 'Invalid QR code', variant: 'destructive' });
          return;
        }

        processingRef.current = true;
        setProcessing(true);

        try {
          const users = await searchUsers(username);
          const user = users.find((u: any) => u.username === username);
          if (!user) {
            toast({ title: 'User not found', variant: 'destructive' });
            processingRef.current = false;
            setProcessing(false);
            return;
          }

          const status = await checkExistingRequest(user.user_id);
          
          if (status === 'none') {
            const result = await sendChatRequest(user.user_id);
            if (result.success) {
              toast({ title: `Request sent to @${username}` });
            } else {
              toast({ title: result.error || 'Failed', variant: 'destructive' });
            }
          } else if (status === 'received') {
            const convoId = await getOrCreateConversation(user.user_id);
            if (convoId) {
              await scanner.stop().catch(() => {});
              onStartChat(convoId, user);
              return;
            }
          } else {
            toast({ title: 'Request already pending' });
          }
        } catch {
          toast({ title: 'Error processing QR', variant: 'destructive' });
        }

        processingRef.current = false;
        setProcessing(false);
        await scanner.stop().catch(() => {});
        onClose();
      },
      () => {}
    ).catch((err) => {
      console.error('QR Scanner error:', err);
      toast({ title: 'Camera access denied', variant: 'destructive' });
      onClose();
    });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [mounted]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-chat-header">
        <h2 className="text-foreground font-semibold">Scan QR Code</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div id="qr-reader" className="w-full max-w-sm rounded-xl overflow-hidden" />
      </div>
      {processing && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <p className="text-foreground">Processing...</p>
        </div>
      )}
    </div>
  );
}
