import { useEffect, useState } from 'react';
import { Send, Megaphone } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { adminCall } from '@/lib/admin';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export default function AdminBroadcasts() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const { toast } = useToast();

  const load = async () => {
    const r = await adminCall('list_broadcasts');
    setItems(r.broadcasts || []);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    await adminCall('broadcast', { content: text.trim() });
    setText('');
    toast({ title: 'Broadcast sent to all users' });
    load();
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Global Broadcast</h1>
        <p className="text-sm text-muted-foreground">Sender appears as <span className="text-primary">QuickChat</span></p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type announcement... e.g. Server maintenance tonight at 11 PM" rows={4} className="bg-secondary/30" />
        <Button onClick={send} disabled={sending} className="w-full bg-primary hover:bg-primary/90">
          <Send className="w-4 h-4 mr-2" /> Send to All Users
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">History</h3>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted-foreground">No broadcasts yet</p>}
          {items.map(b => (
            <div key={b.id} className="bg-card border border-border rounded-xl p-3 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-primary">QuickChat</span>
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(b.created_at))} ago</span>
                </div>
                <p className="text-sm text-foreground mt-0.5 break-words">{b.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
