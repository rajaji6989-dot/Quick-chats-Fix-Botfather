import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Check, CheckCheck, Phone, Video, Image as ImageIcon, X, Reply, PhoneIncoming, PhoneOutgoing, PhoneMissed, VideoIcon } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getMessages, sendMessage, markMessagesAsSeen, setTypingStatus } from '@/lib/chat';
import { uploadChatImage, sendImageMessage } from '@/lib/calls';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import UserBadge from './UserBadge';
import { isLive, presenceLabel } from '@/lib/presence';

interface ChatAreaProps {
  conversationId: string;
  otherUser: any;
  currentUserId: string;
  onBack: () => void;
  onCall?: (type: 'voice' | 'video') => void;
}

function MessageTick({ status }: { status: string }) {
  if (status === 'seen') return <CheckCheck className="w-4 h-4 text-tick-blue" />;
  if (status === 'delivered') return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
  return <Check className="w-4 h-4 text-muted-foreground" />;
}

function CircularProgress({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} stroke="currentColor" strokeWidth="3" fill="none" className="text-foreground/20" />
        <circle
          cx="22" cy="22" r={r}
          stroke="currentColor" strokeWidth="3" fill="none"
          strokeDasharray={c} strokeDashoffset={offset}
          className="text-primary transition-all duration-200"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
        {pct}%
      </span>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-3 px-4 py-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
          <div className={`shimmer rounded-xl ${i % 2 ? 'w-40 h-10' : 'w-52 h-12'}`} />
        </div>
      ))}
    </div>
  );
}

export default function ChatArea({ conversationId, otherUser, currentUserId, onBack, onCall }: ChatAreaProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [displayUser, setDisplayUser] = useState<any>(otherUser);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    setDisplayUser(otherUser);
  }, [otherUser]);

  useEffect(() => {
    if (!otherUser?.user_id) return;
    const channel = supabase
      .channel(`chat-profile-${otherUser.user_id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${otherUser.user_id}`,
      }, (payload: any) => {
        if (payload.new) {
          setDisplayUser((prev: any) => ({ ...prev, ...payload.new }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [otherUser?.user_id]);

  const loadMessages = useCallback(async () => {
    const msgs = await getMessages(conversationId);
    setMessages(msgs);
    setLoadingMessages(false);
    if (otherUser?.user_id) {
      await markMessagesAsSeen(conversationId, otherUser.user_id);
    }
  }, [conversationId, otherUser?.user_id]);

  useEffect(() => { setLoadingMessages(true); loadMessages(); }, [loadMessages]);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => prev.some(m => m.id === (payload.new as any).id) ? prev : [...prev, payload.new]);
        if ((payload.new as any).sender_id !== currentUserId) {
          markMessagesAsSeen(conversationId, (payload.new as any).sender_id);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === (payload.new as any).id ? payload.new : m));
      })
      .subscribe();

    const typingChannel = supabase
      .channel(`typing-${conversationId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'typing_indicators',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload: any) => {
        if (payload.new?.user_id !== currentUserId) {
          setOtherTyping(payload.new?.is_typing || false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      setTypingStatus(conversationId, false);
    };
  }, [conversationId, currentUserId]);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (!isTyping) {
      setIsTyping(true);
      setTypingStatus(conversationId, true);
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      setTypingStatus(conversationId, false);
    }, 2000);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    const reply = replyTo?.id;
    setInput('');
    setReplyTo(null);
    setIsTyping(false);
    setTypingStatus(conversationId, false);
    await sendMessage(conversationId, content, reply);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('Image must be under 20MB');
      return;
    }
    setUploadPct(0);
    const url = await uploadChatImage(conversationId, file, (p) => setUploadPct(p));
    if (url) {
      await sendImageMessage(conversationId, url, undefined, replyTo?.id);
      setReplyTo(null);
    }
    setUploadPct(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const findMessage = (id: string) => messages.find(m => m.id === id);

  const renderCallMessage = (msg: any) => {
    const data = msg.call_data || {};
    const isMine = msg.sender_id === currentUserId;
    const isVideo = data.call_type === 'video';
    const wasMissed = data.status === 'missed' || data.status === 'rejected';
    const Icon = wasMissed ? PhoneMissed : isMine ? PhoneOutgoing : PhoneIncoming;
    const dur = data.duration || 0;
    const durStr = dur > 0 ? ` · ${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` : '';
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${isMine ? 'bg-chat-sent' : 'bg-chat-received'}`}>
          {isVideo ? <VideoIcon className={`w-4 h-4 ${wasMissed ? 'text-destructive' : 'text-primary'}`} /> : <Icon className={`w-4 h-4 ${wasMissed ? 'text-destructive' : 'text-primary'}`} />}
          <span className="text-foreground">
            {wasMissed ? `Missed ${data.call_type} call` : `${isVideo ? 'Video' : 'Voice'} call${durStr}`}
          </span>
          <span className="text-[10px] text-muted-foreground ml-2">{format(new Date(msg.created_at), 'HH:mm')}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-chat-bg">
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center" onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground z-10">
            <X className="w-6 h-6" />
          </button>
          <img src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-chat-header border-b border-border">
        <button onClick={onBack} className="md:hidden p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative">
          <Avatar className="w-10 h-10">
            {displayUser?.avatar_url && <AvatarImage src={displayUser.avatar_url} />}
            <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
              {displayUser?.username?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          {isLive(displayUser) && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-online rounded-full border-2 border-chat-header" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-medium text-foreground text-sm truncate">@{displayUser?.username}</p>
            <UserBadge badge={displayUser?.badge || (displayUser?.is_premium ? 'premium' : null)} size="xs" />
          </div>
          <p className="text-xs text-muted-foreground">
            {otherTyping ? <span className="text-primary">typing…</span> : presenceLabel(displayUser)}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-1">
        {loadingMessages ? (
          <MessageSkeleton />
        ) : (
          messages.map((msg, i) => {
            if (msg.message_type === 'call') {
              return <div key={msg.id} className="my-2">{renderCallMessage(msg)}</div>;
            }
            const isMine = msg.sender_id === currentUserId;
            const showTime = i === 0 || (
              new Date(msg.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 300000
            );
            const repliedMsg = msg.reply_to_id ? findMessage(msg.reply_to_id) : null;
            const isImage = !!msg.image_url;

            return (
              <div key={msg.id}>
                {showTime && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] text-muted-foreground bg-card/80 px-3 py-1 rounded-lg">
                      {format(new Date(msg.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                )}
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group animate-fade-in items-end gap-1`}>
                  {!isMine && (
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-primary"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                  )}
                  <div
                    onDoubleClick={() => setReplyTo(msg)}
                    className={`${isImage ? 'p-1' : 'px-3 py-2'} ${isImage && !msg.content ? 'max-w-[260px]' : 'max-w-[75%]'} rounded-xl text-sm leading-relaxed ${
                      isMine ? 'bg-chat-sent text-foreground rounded-tr-sm' : 'bg-chat-received text-foreground rounded-tl-sm'
                    }`}
                  >
                    {repliedMsg && (
                      <div className={`mb-1 px-2 py-1.5 rounded-lg border-l-2 border-primary text-xs ${isMine ? 'bg-black/20' : 'bg-black/30'}`}>
                        <p className="text-primary font-medium text-[10px]">
                          {repliedMsg.sender_id === currentUserId ? 'You' : `@${otherUser?.username}`}
                        </p>
                        <p className="text-muted-foreground truncate">
                          {repliedMsg.image_url ? '📷 Photo' : repliedMsg.content}
                        </p>
                      </div>
                    )}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        alt="Shared"
                        className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity block"
                        style={{ maxHeight: '300px' }}
                        onClick={() => setPreviewImage(msg.image_url)}
                      />
                    )}
                    {msg.content && <p className={`break-words whitespace-pre-wrap ${isImage ? 'px-2 pt-1' : ''}`}>{msg.content}</p>}
                    <div className={`flex items-center gap-1 ${isImage ? 'px-2 pb-1' : 'mt-1'} ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                      {isMine && <MessageTick status={msg.status} />}
                    </div>
                  </div>
                  {isMine && (
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-primary"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upload progress (WhatsApp style) */}
      {uploadPct !== null && (
        <div className="px-4 py-2 bg-chat-header border-t border-border flex items-center gap-3">
          <CircularProgress pct={uploadPct} />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">Sending photo</p>
            <p className="text-[10px] text-muted-foreground">{uploadPct < 100 ? 'Uploading...' : 'Finishing...'}</p>
          </div>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 bg-chat-header border-t border-border flex items-center gap-2">
          <div className="flex-1 border-l-2 border-primary pl-3 py-1">
            <p className="text-xs text-primary font-medium">
              {replyTo.sender_id === currentUserId ? 'You' : `@${otherUser?.username}`}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.image_url ? '📷 Photo' : replyTo.content}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-chat-header border-t border-border">
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadPct !== null}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            className="flex-1 h-10 px-4 rounded-xl bg-chat-input-bg text-foreground placeholder:text-muted-foreground border-0 outline-none text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
