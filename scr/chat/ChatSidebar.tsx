import { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getUserConversations } from '@/lib/chat';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isYesterday } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import StoriesBar from './StoriesBar';
import UserBadge from './UserBadge';
import KhushiChat from './KhushiChat';
import BotFatherChat from './BotFatherChat';
import BotChat from './BotChat';
import { Bot } from 'lucide-react';
import { getKhushiInfo, getKhushiThreadSummary, KhushiInfo } from '@/lib/khushi';

interface ChatSidebarProps {
  profile: any;
  activeConversation: string | null;
  onSelectConversation: (convoId: string, otherUser: any) => void;
  onOpenSettings: () => void;
  onOpenScanner: () => void;
  onOpenPinSetup?: () => void;
  onSignOut: () => void;
  onOpenStories: (groups: any[], index: number) => void;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM/yyyy');
}

export default function ChatSidebar({ profile, activeConversation, onSelectConversation, onOpenSettings, onOpenScanner, onOpenPinSetup, onSignOut, onOpenStories }: ChatSidebarProps) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [botChats, setBotChats] = useState<any[]>([]);
  const [openBot, setOpenBot] = useState<any>(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [showKhushi, setShowKhushi] = useState(false);
  const [showBotFather, setShowBotFather] = useState(false);
  const [khushiInfo, setKhushiInfo] = useState<KhushiInfo | null>(null);
  const [khushiThread, setKhushiThread] = useState<{ content: string; created_at: string; role: string } | null>(null);

  const loadKhushi = async () => {
    setKhushiInfo(await getKhushiInfo(true));
    setKhushiThread(await getKhushiThreadSummary());
  };

  useEffect(() => { loadKhushi(); }, []);

  const loadConversations = async () => {
    const convos = await getUserConversations();
    setConversations(convos);
    setLoadingConvos(false);
  };

  const loadBotChats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: chats } = await (supabase as any)
      .from('bot_chats')
      .select('bot_id, started, started_at')
      .eq('user_id', user.id)
      .eq('started', true);
    if (!chats?.length) { setBotChats([]); return; }
    const botIds = chats.map((c: any) => c.bot_id);
    const { data: bots } = await (supabase as any)
      .from('bots')
      .select('id, bot_name, bot_username, photo_url, last_polled_at')
      .in('id', botIds);
    const ONLINE_MS = 90_000;
    const merged = (bots || []).map((b: any) => {
      const chat = chats.find((c: any) => c.bot_id === b.id);
      const polled = b.last_polled_at ? new Date(b.last_polled_at).getTime() : 0;
      return {
        id: b.id,
        bot_username: b.bot_username,
        bot_name: b.bot_name,
        photo_url: b.photo_url,
        is_online: polled > 0 && (Date.now() - polled) < ONLINE_MS,
        started_at: chat?.started_at,
      };
    });
    setBotChats(merged);
  };

  useEffect(() => {
    loadConversations();
    loadBotChats();
    let channel: any = null;
    const timer = setTimeout(() => {
      channel = supabase.channel(`sidebar-messages-${Math.random().toString(36).slice(2)}`);
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadConversations());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, () => loadConversations());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadConversations());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'bot_chats' }, () => loadBotChats());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'bot_messages' }, () => loadBotChats());
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'ai_messages' }, () => loadKhushi());
      channel.subscribe();
    }, 0);
    const tick = setInterval(loadBotChats, 60_000);
    return () => { clearTimeout(timer); clearInterval(tick); if (channel) supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeConversation) loadConversations();
  }, [activeConversation]);

  const qrValue = profile?.username ? `${window.location.origin}/?u=${encodeURIComponent(profile.username)}` : '';
  const hasConversations = conversations.length > 0;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border relative">
      {showKhushi && <KhushiChat onClose={() => setShowKhushi(false)} />}
      {showBotFather && <BotFatherChat onClose={() => setShowBotFather(false)} />}
      {openBot && <BotChat bot={openBot} onClose={() => { setOpenBot(null); loadBotChats(); }} />}
      {/* Stories */}
      <StoriesBar currentUserId={profile?.user_id} currentProfile={profile} onOpen={onOpenStories} />

      {/* Conversation List or QR Empty State */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loadingConvos && (
          <div className="space-y-1 p-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-3">
                <div className="w-12 h-12 rounded-full shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 rounded shimmer" />
                  <div className="h-2.5 w-3/4 rounded shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loadingConvos && !hasConversations && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-8 text-center">
            <div className="bg-card border border-border rounded-2xl p-6 mb-4">
              <QRCodeSVG
                value={qrValue}
                size={160}
                bgColor="transparent"
                fgColor="hsl(var(--primary))"
                level="M"
              />
            </div>
            <p className="text-sm text-foreground font-medium">Your QR Code</p>
            <p className="text-xs mt-1 text-muted-foreground">Share with friends to start chatting</p>
          </div>
        )}
        {/* Pinned BotFather system entry */}
        <button
          onClick={() => setShowBotFather(true)}
          className="w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-border/30 hover:bg-secondary/30"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow">
              <Bot className="w-6 h-6" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-online rounded-full border-2 border-card" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground text-sm">BotFather</span>
              <UserBadge badge="verified" size="xs" />
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">Create and manage your bots</p>
          </div>
        </button>
        {/* ᴋʜᴜsɪ entry — shown once user has chatted with her at least once */}
        {khushiInfo?.enabled && khushiThread && (
          <button
            onClick={() => setShowKhushi(true)}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-border/30 hover:bg-secondary/30"
          >
            <Avatar className="w-12 h-12">
              {khushiInfo.avatar_url && <AvatarImage src={khushiInfo.avatar_url} />}
              <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                {khushiInfo.display_name[0]?.toUpperCase() || 'K'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-medium text-foreground text-sm truncate">{khushiInfo.display_name}</span>
                  <UserBadge badge="verified_red" size="xs" />
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
                  {formatTime(khushiThread.created_at)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {khushiThread.role === 'user' ? 'You: ' : ''}{khushiThread.content}
              </p>
            </div>
          </button>
        )}
        {/* Active bot chats */}
        {botChats.map((b) => (
          <button
            key={`bot-${b.id}`}
            onClick={() => setOpenBot(b)}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-border/30 hover:bg-secondary/30"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow overflow-hidden">
                {b.photo_url
                  ? <img src={b.photo_url} alt={b.bot_name} className="w-full h-full object-cover" />
                  : <Bot className="w-6 h-6" />}
              </div>
              {b.is_online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-online rounded-full border-2 border-card" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground text-sm truncate">{b.bot_name}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">@{b.bot_username} · {b.is_online ? 'online' : 'offline'}</p>
            </div>
          </button>
        ))}
        {conversations.map((convo) => (
          <button
            key={convo.id}
            onClick={() => onSelectConversation(convo.id, {
              user_id: convo.otherUserId,
              username: convo.username,
              avatar_url: convo.avatarUrl,
              is_online: convo.isOnline,
              last_seen: convo.lastSeen,
              badge: convo.badge,
            })}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-border/30 ${
              activeConversation === convo.id ? 'bg-secondary' : 'hover:bg-secondary/30'
            }`}
          >
            <div className="relative">
              <Avatar className="w-12 h-12">
                {convo.avatarUrl && <AvatarImage src={convo.avatarUrl} />}
                <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                  {convo.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {convo.isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-online rounded-full border-2 border-card" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-medium text-foreground text-sm truncate">@{convo.username}</span>
                  <UserBadge badge={convo.badge} size="xs" />
                </div>
                {convo.lastMessage && (
                  <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
                    {formatTime(convo.lastMessage.created_at)}
                  </span>
                )}
              </div>
              {convo.lastMessage && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {convo.lastMessage.message_type === 'call'
                    ? `📞 ${convo.lastMessage.call_data?.call_type === 'video' ? 'Video' : 'Voice'} call`
                    : convo.lastMessage.image_url
                      ? '📷 Photo'
                      : convo.lastMessage.content}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

    </div>
  );
}
