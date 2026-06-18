import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Bot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import UserBadge from './UserBadge';

interface BotInfo {
  id: string;
  bot_username: string;
  bot_name: string;
  photo_url?: string | null;
}

interface Props {
  bot: BotInfo;
  onClose: () => void;
}

interface Msg {
  id: string;
  message_id: number;
  text: string | null;
  from_user_id: string | null;
  created_at: string;
  deleted: boolean;
}

export default function BotChat({ bot, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState<boolean | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const [{ data: msgs }, { data: chat }] = await Promise.all([
      (supabase as any).from('bot_messages')
        .select('id,message_id,text,from_user_id,created_at,deleted')
        .eq('bot_id', bot.id).eq('chat_id', user.id)
        .order('message_id', { ascending: true }).limit(200),
      (supabase as any).from('bot_chats').select('started')
        .eq('bot_id', bot.id).eq('user_id', user.id).maybeSingle(),
    ]);
    setMessages((msgs as Msg[]) || []);
    setStarted(!!chat?.started);
  };

  useEffect(() => { load(); }, [bot.id]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`bot-chat-${bot.id}-${me}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bot_messages',
        filter: `bot_id=eq.${bot.id}`,
      }, (payload: any) => {
        const row = payload.new || payload.old;
        if (!row || row.chat_id !== me) return;
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, bot.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleStart = async () => {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('bot-send', {
        body: { bot_username: bot.bot_username, action: 'start' },
      });
      if (error) throw error;
      await load();
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('bot-send', {
        body: { bot_username: bot.bot_username, action: 'message', text },
      });
      if (error) throw error;
      await load();
    } finally {
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
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-lg overflow-hidden">
            {bot.photo_url
              ? <img src={bot.photo_url} alt={bot.bot_name} className="w-full h-full object-cover" />
              : <Bot className="w-5 h-5" />}
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-online rounded-full border-2 border-chat-header" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-foreground truncate">{bot.bot_name}</span>
          </div>
          <p className="text-[11px] text-online">@{bot.bot_username} · bot</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 scrollbar-thin">
        {messages.filter(m => !m.deleted).map((m) => {
          const mine = !!m.from_user_id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[82%] px-3 py-2 text-[14px] leading-snug whitespace-pre-wrap break-words shadow-sm mt-1 ${
                mine
                  ? 'bg-[#005c4b] text-white rounded-2xl rounded-br-md'
                  : 'bg-[#202c33] text-foreground rounded-2xl rounded-bl-md'
              }`}>
                {m.text}
              </div>
            </div>
          );
        })}
        {started === false && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-12">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white mb-4 shadow-lg overflow-hidden">
              {bot.photo_url
                ? <img src={bot.photo_url} alt={bot.bot_name} className="w-full h-full object-cover" />
                : <Bot className="w-10 h-10" />}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{bot.bot_name}</h2>
            <p className="text-xs text-muted-foreground">@{bot.bot_username}</p>
            <p className="text-sm text-muted-foreground mt-3 max-w-xs">
              Press START to begin chatting. The bot will receive your messages via webhook or getUpdates.
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
        <div className="bg-chat-header border-t border-border p-2 safe-pb">
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
                placeholder={`Message @${bot.bot_username}...`}
                className="w-full bg-transparent outline-none resize-none text-sm max-h-32"
              />
            </div>
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white flex items-center justify-center disabled:opacity-50 active:scale-95 shadow-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
