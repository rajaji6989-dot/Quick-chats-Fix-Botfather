import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import UserBadge from './UserBadge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getKhushiInfo, KhushiInfo } from '@/lib/khushi';
import { formatLastSeen } from '@/lib/presence';

interface Props {
  onClose: () => void;
}

interface Msg { id: string; role: 'user' | 'assistant'; content: string; created_at: string; }

function randomDelay() {
  // Random 5–30 seconds
  return 5_000 + Math.floor(Math.random() * 25_000);
}

export default function KhushiChat({ onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [info, setInfo] = useState<KhushiInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Random presence on mount — sometimes online, sometimes "last seen"
  const presence = useMemo(() => {
    if (Math.random() < 0.45) return { online: true, lastSeen: null as string | null };
    const ago = (1 + Math.floor(Math.random() * 90)) * 60_000; // 1–90 mins ago
    return { online: false, lastSeen: new Date(Date.now() - ago).toISOString() };
  }, []);

  useEffect(() => {
    (async () => {
      setInfo(await getKhushiInfo(true));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('ai_messages').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100);
      setMessages((data as Msg[]) || []);
      if (!data || data.length === 0) {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: 'hii 🙂',
          created_at: new Date().toISOString(),
        }]);
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setMessages((m) => [...m, {
      id: crypto.randomUUID(), role: 'user', content: text, created_at: new Date().toISOString(),
    }]);
    try {
      // Pre-delay before showing typing — feels more "busy human"
      const totalDelay = randomDelay();
      const preTypingDelay = Math.min(totalDelay, 1500 + Math.floor(Math.random() * 4000));
      await new Promise((r) => setTimeout(r, preTypingDelay));
      setTyping(true);

      // Kick off network call in parallel with remaining delay
      const apiPromise = supabase.functions.invoke('ai-chat', { body: { message: text } });
      const remaining = Math.max(800, totalDelay - preTypingDelay);
      const [res] = await Promise.all([
        apiPromise,
        new Promise((r) => setTimeout(r, remaining)),
      ]);
      const { data, error } = res as any;
      if (error || !data?.reply) throw new Error(data?.error || 'AI error');
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: 'assistant', content: data.reply, created_at: new Date().toISOString(),
      }]);
    } catch {
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: 'assistant',
        content: 'arre network issue 🙃 baad me try karo',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setTyping(false);
      setSending(false);
    }
  };

  const displayName = info?.display_name || 'ᴋʜᴜsɪ';
  const avatar = info?.avatar_url;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-chat-bg animate-fade-in">
      {/* Header — same as a normal user chat */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-chat-header border-b border-border safe-pt">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary active:scale-95">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative">
          <Avatar className="w-10 h-10">
            {avatar && <AvatarImage src={avatar} alt={displayName} />}
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
              {displayName[0]?.toUpperCase() || 'K'}
            </AvatarFallback>
          </Avatar>
          {presence.online && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-online rounded-full border-2 border-chat-header" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-foreground truncate">{displayName}</span>
            <UserBadge badge="verified_red" size="xs" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {typing ? 'typing...' : presence.online ? 'online' : formatLastSeen(presence.lastSeen)}
          </p>
        </div>
      </div>

      {/* Messages — same WhatsApp-style bubbles as a normal user */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 scrollbar-thin">
        {messages.map((m, i) => {
          const mine = m.role === 'user';
          const prev = messages[i - 1];
          const grouped = prev && prev.role === m.role;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div
                className={`max-w-[78%] px-3 py-2 text-[14.5px] leading-snug whitespace-pre-wrap break-words shadow-sm ${
                  mine
                    ? 'bg-[#005c4b] text-white rounded-2xl rounded-br-md'
                    : 'bg-[#202c33] text-foreground rounded-2xl rounded-bl-md'
                } ${grouped ? 'mt-0.5' : 'mt-2'}`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-[#202c33] rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-chat-header border-t border-border p-2 safe-pb">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-secondary rounded-3xl px-4 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={1}
              placeholder={`Message ${displayName}...`}
              className="w-full bg-transparent outline-none resize-none text-sm max-h-32"
            />
          </div>
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 active:scale-95 shadow"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
