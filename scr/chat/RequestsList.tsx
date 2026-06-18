import { useState, useEffect } from 'react';
import { Users, Check, X, Search, UserPlus, Lock, ScanLine, Bot } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getIncomingRequests, acceptRequest, rejectRequest, sendChatRequest, checkExistingRequest } from '@/lib/requests';
import { searchUsers } from '@/lib/auth';
import { getOrCreateConversation } from '@/lib/chat';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import UserBadge from './UserBadge';
import BotFatherChat from './BotFatherChat';
import BotChat from './BotChat';
import KhushiChat from './KhushiChat';

interface RequestsListProps {
  onAccept: (convoId: string, otherUser: any) => void;
  onOpenScanner?: () => void;
  onOpenPinSetup?: () => void;
}

export default function RequestsList({ onAccept, onOpenScanner, onOpenPinSetup }: RequestsListProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [reqStatuses, setReqStatuses] = useState<Record<string, string>>({});
  const [showBotFather, setShowBotFather] = useState(false);
  const [openBot, setOpenBot] = useState<any>(null);
  const [showKhushi, setShowKhushi] = useState(false);
  const { toast } = useToast();

  const q = searchQuery.trim().toLowerCase();
  const showBotFatherEntry = q.length >= 2 && 'botfather'.startsWith(q);

  const loadRequests = async () => {
    const data = await getIncomingRequests();
    setRequests(data);
    setLoadingList(false);
  };

  useEffect(() => {
    loadRequests();

    let channel: any = null;
    const t = setTimeout(() => {
      channel = supabase.channel(`requests-updates-${Math.random().toString(36).slice(2)}`);
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_requests' }, () => loadRequests())
        .subscribe();
    }, 0);

    return () => {
      clearTimeout(t);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const r = await searchUsers(searchQuery);
      setSearchResults(r);
      const s: Record<string, string> = {};
      for (const u of r) { if ((u as any).is_bot || (u as any).is_khushi) continue; s[u.user_id] = await checkExistingRequest(u.user_id); }
      setReqStatuses(s);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSendReq = async (u: any) => {
    const r = await sendChatRequest(u.user_id);
    if (r.success) {
      toast({ title: `Request sent to @${u.username}` });
      setReqStatuses(p => ({ ...p, [u.user_id]: 'sent' }));
    } else toast({ title: r.error || 'Failed', variant: 'destructive' });
  };

  const handleStartChatNow = async (u: any) => {
    const id = await getOrCreateConversation(u.user_id);
    if (id) onAccept(id, u);
  };

  const handleAccept = async (req: any) => {
    setLoading(req.id);
    const convoId = await acceptRequest(req.id, req.sender_id);
    if (convoId && req.sender) {
      toast({ title: `Accepted request from @${req.sender.username}` });
      onAccept(convoId, {
        user_id: req.sender.user_id,
        username: req.sender.username,
        avatar_url: req.sender.avatar_url,
        is_online: req.sender.is_online,
        last_seen: req.sender.last_seen,
        badge: req.sender.badge,
        is_premium: req.sender.is_premium,
      });
    }
    setLoading(null);
    loadRequests();
  };

  const handleReject = async (req: any) => {
    setLoading(req.id);
    await rejectRequest(req.id);
    toast({ title: 'Request rejected' });
    setLoading(null);
    loadRequests();
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {showBotFather && <BotFatherChat onClose={() => setShowBotFather(false)} />}
      {openBot && <BotChat bot={openBot} onClose={() => setOpenBot(null)} />}
      {showKhushi && <KhushiChat onClose={() => setShowKhushi(false)} />}
      <div className="px-4 py-3 bg-chat-header border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Requests</h2>
          {requests.length > 0 && <p className="text-xs text-muted-foreground">{requests.length} pending</p>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onOpenPinSetup?.()} className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <Lock className="w-5 h-5" />
          </button>
          <button onClick={() => onOpenScanner?.()} className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ScanLine className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users to add"
            className="pl-10 h-9 bg-secondary border-0 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Search results */}
        {(searchResults.length > 0 || showBotFatherEntry) && (
          <div className="border-b border-border">
            <p className="px-4 py-2 text-xs text-primary font-medium uppercase">Users</p>
            {showBotFatherEntry && (
              <button
                onClick={() => setShowBotFather(true)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 text-left"
              >
                <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow">
                  <Bot className="w-5 h-5" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-online rounded-full border-2 border-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-foreground truncate">@BotFather</p>
                    <UserBadge badge="verified" size="xs" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Create and manage your bots</p>
                </div>
                <span className="text-xs text-primary">Chat</span>
              </button>
            )}
            {searchResults.map((u: any) => {
              if (u.is_khushi) {
                return (
                  <button
                    key={u.id}
                    onClick={() => setShowKhushi(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 text-left"
                  >
                    <Avatar className="w-11 h-11">
                      {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                        {(u.display_name || u.username)[0]?.toUpperCase() || 'K'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-foreground truncate">{u.display_name || u.username}</p>
                        <UserBadge badge="verified_red" size="xs" />
                      </div>
                      <p className="text-[11px] text-muted-foreground">@{u.username}</p>
                    </div>
                    <span className="text-xs text-primary">Chat</span>
                  </button>
                );
              }
              if (u.is_bot) {
                return (
                  <button
                    key={u.id}
                    onClick={() => setOpenBot({ id: u.id, bot_username: u.username, bot_name: u.bot_name, photo_url: u.avatar_url })}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 text-left"
                  >
                    <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow overflow-hidden">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={u.bot_name} className="w-full h-full object-cover" />
                        : <Bot className="w-5 h-5" />}
                      {u.is_online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-online rounded-full border-2 border-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-foreground truncate">{u.bot_name}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">@{u.username} · {u.is_online ? 'online' : 'offline'} · bot</p>
                    </div>
                    <span className="text-xs text-primary">Chat</span>
                  </button>
                );
              }
              const status = reqStatuses[u.user_id] || 'none';
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30">
                  <Avatar className="w-11 h-11">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                    <AvatarFallback>{u.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-medium text-foreground truncate">@{u.username}</p>
                      <UserBadge badge={u.badge} size="xs" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{u.is_online ? 'Online' : 'Offline'}</p>
                  </div>
                  {status === 'accepted' ? (
                    <Button size="sm" variant="ghost" onClick={() => handleStartChatNow(u)} className="h-8 text-xs text-primary">Chat</Button>
                  ) : status === 'sent' ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Check className="w-3 h-3" /> Pending</span>
                  ) : status === 'received' ? (
                    <span className="text-xs text-primary">Requested you</span>
                  ) : (
                    <Button size="sm" onClick={() => handleSendReq(u)} className="h-8 px-3 text-xs rounded-full bg-primary hover:bg-primary/90">
                      <UserPlus className="w-3 h-3 mr-1" /> Request
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Loading skeleton */}
        {loadingList && !searchQuery && (
          <div className="space-y-1 p-2">
            {[...Array(5)].map((_, i) => (
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

        {/* Empty */}
        {!loadingList && requests.length === 0 && searchResults.length === 0 && !searchQuery && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground px-8 text-center">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No pending requests</p>
            <p className="text-xs mt-1">Use search above to find users</p>
          </div>
        )}

        {/* Requests */}
        {requests.map((req) => (
          <div key={req.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
            <Avatar className="w-12 h-12">
              {req.sender?.avatar_url && <AvatarImage src={req.sender.avatar_url} />}
              <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                {req.sender?.username?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-foreground truncate">@{req.sender?.username}</p>
                <UserBadge badge={req.sender?.badge} size="xs" />
              </div>
              <p className="text-xs text-muted-foreground">Wants to chat with you</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleAccept(req)} disabled={loading === req.id} className="h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90">
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleReject(req)} disabled={loading === req.id} className="h-8 w-8 p-0 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
