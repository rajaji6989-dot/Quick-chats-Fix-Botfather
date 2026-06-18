import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Megaphone } from 'lucide-react';

const SEEN_KEY = 'qc_seen_broadcasts';

function getSeen(): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}
function markSeen(id: string) {
  const seen = getSeen();
  if (!seen.includes(id)) {
    seen.push(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-200)));
  }
}

export default function BroadcastListener() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const showBroadcast = (b: any) => {
      if (getSeen().includes(b.id)) return;
      markSeen(b.id);
      toast(
        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">QuickChat</p>
            <p className="text-sm text-foreground break-words">{b.content}</p>
            {b.image_url && <img src={b.image_url} alt="" className="mt-2 rounded-lg max-h-40 object-cover" />}
          </div>
        </div>,
        { duration: 8000 }
      );
    };

    // Show recent unseen broadcasts on load (last 10 in past 24h)
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('broadcasts')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(10);
      (data || []).forEach(showBroadcast);
    })();

    const channel = supabase
      .channel('broadcasts-listener')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcasts' }, (payload) => {
        showBroadcast(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return null;
}
