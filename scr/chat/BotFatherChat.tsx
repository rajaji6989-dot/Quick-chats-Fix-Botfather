import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Bot, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import UserBadge from './UserBadge';

interface Props {
  onClose: () => void;
}

interface Msg { id: string; role: 'user' | 'bot'; content: string; created_at: string; }

const QUICK_COMMANDS = ['/newbot', '/mybots', '/api', '/help'];

export default function BotFatherChat({ onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [started, setStarted] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: msgs }, { data: sess }] = await Promise.all([
      supabase.from('botfather_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(200),
      supabase.from('botfather_sessions').select('started').eq('user_id', user.id).maybeSingle(),
    ]);
    setMessages((msgs as Msg[]) || []);
    setStarted(!!sess?.started);
  };

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => { if (started) inputRef.current?.focus(); }, [started]);

  const handleStart = async () => {
    setSending(true);
    setTyping(true);
    try {
      await supabase.functions.invoke('botfather', { body: { action: 'start' } });
      await loadHistory();
    } finally {
      setSending(false);
      setTyping(false);
    }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    const tempId = crypto.randomUUID();
    setMessages((m) => [...m, { id: tempId, role: 'user', content: text, created_at: new Date().toISOString() }]);
    setTyping(true);
    try {
      const { error } = await supabase.functions.invoke('botfather', { body: { action: 'message', text } });
      if (error) throw error;
      await loadHistory();
    } catch {
      setMessages((m) => [...m, {
        id: crypto.randomUUID(), role: 'bot',
        content: 'Something went wrong. Please try again.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setTyping(false);
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-chat-bg animate-fade-in">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-chat-header border-b border-border safe-pt">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary active:scale-95">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-lg">
            <Bot className="w-5 h-5" />
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-online rounded-full border-2 border-chat-header" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-foreground truncate">BotFather</span>
            <UserBadge badge="verified" size="xs" />
          </div>
          <p className="text-[11px] text-online">{typing ? 'typing...' : 'bot'}</p>
        </div>
        <Link to="/developer" title="Developer Dashboard" className="p-2 rounded-full hover:bg-secondary active:scale-95 text-foreground/80">
          <Code2 className="w-5 h-5" />
        </Link>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 scrollbar-thin">
        {messages.map((m, i) => {
          const mine = m.role === 'user';
          const prev = messages[i - 1];
          const grouped = prev && prev.role === m.role;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div
                className={`max-w-[82%] px-3 py-2 text-[14px] leading-snug whitespace-pre-wrap break-words shadow-sm ${
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
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        {started === false && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-12">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white mb-4 shadow-lg">
              <Bot className="w-10 h-10" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">BotFather</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Create and manage your own bots on QuickChat. Build them in Python, Node.js or any language.
            </p>
          </div>
        )}
      </div>

      {started === false ? (
        <div className="bg-chat-header border-t border-border p-4 safe-pb">
          <button
            onClick={handleStart}
            disabled={sending}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-base shadow-lg active:scale-[0.98] transition disabled:opacity-60"
          >
            START
          </button>
        </div>
      ) : (
        <div className="bg-chat-header border-t border-border safe-pb">
          <div className="px-2 pt-2 flex gap-1.5 overflow-x-auto scrollbar-thin">
            {QUICK_COMMANDS.map((c) => (
              <button
                key={c}
                onClick={() => send(c)}
                disabled={sending}
                className="px-3 py-1 rounded-full bg-secondary text-xs text-foreground/80 hover:bg-secondary/70 active:scale-95 whitespace-nowrap disabled:opacity-50"
              >
                {c}
              </button>
            ))}
          </div>
          <div className="p-2">
            <div className="flex items-end gap-2">
              <div className="flex-1 bg-secondary rounded-3xl px-4 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  rows={1}
                  placeholder="Message BotFather..."
                  className="w-full bg-transparent outline-none resize-none text-sm max-h-32"
                />
              </div>
              <button
                onClick={() => send()}
                disabled={!input.trim() || sending}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white flex items-center justify-center disabled:opacity-50 active:scale-95 shadow-lg"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
