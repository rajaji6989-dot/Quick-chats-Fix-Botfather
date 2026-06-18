import { useState } from 'react';
import { Search, LogIn, Crown, Shield, CheckCircle, Ban, Trash2, KeyRound, X, VolumeX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { adminCall } from '@/lib/admin';
import UserBadge from '@/components/chat/UserBadge';
import { useToast } from '@/hooks/use-toast';

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const { toast } = useToast();

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try { const r = await adminCall('search_user', { q: q.trim() }); setUsers(r.users || []); }
    catch { toast({ title: 'Search failed', variant: 'destructive' }); }
    setLoading(false);
  };

  const setBadge = async (badge: string | null) => {
    await adminCall('set_badge', { user_id: selected.user_id, badge });
    toast({ title: badge ? `Badge set: ${badge}` : 'Badge removed' });
    setSelected({ ...selected, badge });
  };

  const setPremium = async (is_premium: boolean, days?: number) => {
    await adminCall('set_premium', { user_id: selected.user_id, is_premium, days });
    toast({ title: is_premium ? `Premium granted (${days || 0}d)` : 'Premium removed' });
    setSelected({ ...selected, is_premium });
  };

  const setBan = async (is_banned: boolean) => {
    await adminCall('set_ban', { user_id: selected.user_id, is_banned });
    toast({ title: is_banned ? 'User banned' : 'User unbanned' });
    setSelected({ ...selected, is_banned });
  };

  const setMute = async (is_muted: boolean) => {
    await adminCall('set_mute', { user_id: selected.user_id, is_muted });
    toast({ title: is_muted ? 'User muted' : 'User unmuted' });
    setSelected({ ...selected, is_muted });
  };

  const resetBackup = async () => {
    const r = await adminCall('reset_backup', { user_id: selected.user_id });
    toast({ title: `New code: ${r.backup_code}` });
  };

  const deleteUser = async () => {
    if (!confirm(`Delete @${selected.username} permanently?`)) return;
    await adminCall('delete_user', { user_id: selected.user_id });
    toast({ title: 'User deleted' });
    setSelected(null);
    search();
  };

  const loginAsUser = async () => {
    try {
      const r = await adminCall('impersonate', { user_id: selected.user_id });
      if (r.action_link) {
        window.open(r.action_link, '_blank');
        toast({ title: 'Opened user session in new tab' });
      } else { toast({ title: r.error || 'Failed', variant: 'destructive' }); }
    } catch (e: any) { toast({ title: e.message || 'Failed', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-sm text-muted-foreground">Search by username</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search username..." className="pl-10 bg-card border-border" />
        </div>
        <Button onClick={search} disabled={loading} className="bg-primary hover:bg-primary/90">Search</Button>
      </div>

      <div className="grid gap-2">
        {users.map(u => (
          <button key={u.id} onClick={() => setSelected(u)} className="text-left flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition">
            <Avatar className="w-10 h-10">
              {u.avatar_url && <AvatarImage src={u.avatar_url} />}
              <AvatarFallback>{u.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground truncate">@{u.username}</span>
                <UserBadge badge={u.badge} size="xs" />
              </div>
              <p className="text-xs text-muted-foreground">{u.is_online ? 'Online' : 'Offline'} • {u.is_premium ? 'Premium' : 'Free'}</p>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold text-foreground">User Details</h2>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-16 h-16">
                {selected.avatar_url && <AvatarImage src={selected.avatar_url} />}
                <AvatarFallback className="text-2xl">{selected.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-foreground">@{selected.username}</p>
                  <UserBadge badge={selected.badge} size="sm" />
                </div>
                <p className="text-sm text-muted-foreground">{selected.display_name || 'No display name'}</p>
                <p className="text-xs text-muted-foreground">Joined {new Date(selected.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <Info label="Backup Code" value={selected.backup_code} />
              <Info label="Status" value={selected.is_online ? '🟢 Online' : '⚪ Offline'} />
              <Info label="Premium" value={selected.is_premium ? '✅ Yes' : '❌ No'} />
              <Info label="Banned" value={selected.is_banned ? '🚫 Yes' : '✅ No'} />
              <Info label="Last Seen" value={selected.last_seen ? new Date(selected.last_seen).toLocaleString() : '-'} />
              <Info label="Premium Until" value={selected.premium_until ? new Date(selected.premium_until).toLocaleDateString() : '-'} />
            </div>

            <Button onClick={loginAsUser} className="w-full mb-3 bg-gradient-to-r from-red-500 to-red-700 text-white">
              <LogIn className="w-4 h-4 mr-2" /> Login As User
            </Button>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Badge</p>
              <div className="grid grid-cols-4 gap-2">
                <Button size="sm" variant="outline" onClick={() => setBadge('verified')}><CheckCircle className="w-3 h-3 mr-1 text-blue-500" />Blue</Button>
                <Button size="sm" variant="outline" onClick={() => setBadge('premium')}><Crown className="w-3 h-3 mr-1 text-yellow-500" />Gold</Button>
                <Button size="sm" variant="outline" onClick={() => setBadge('admin')}><Shield className="w-3 h-3 mr-1 text-red-500" />Red</Button>
                <Button size="sm" variant="outline" onClick={() => setBadge(null)}>Clear</Button>
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase mt-3">Premium</p>
              <div className="grid grid-cols-4 gap-2">
                <Button size="sm" variant="outline" onClick={() => setPremium(true, 7)}>+7d</Button>
                <Button size="sm" variant="outline" onClick={() => setPremium(true, 30)}>+30d</Button>
                <Button size="sm" variant="outline" onClick={() => setPremium(true, 365)}>+1y</Button>
                <Button size="sm" variant="outline" onClick={() => setPremium(false)}>Remove</Button>
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase mt-3">Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => setBan(!selected.is_banned)}>
                  <Ban className="w-3 h-3 mr-1" /> {selected.is_banned ? 'Unban' : 'Ban'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMute(!selected.is_muted)}>
                  <VolumeX className="w-3 h-3 mr-1" /> {selected.is_muted ? 'Unmute' : 'Mute'}
                </Button>
                <Button size="sm" variant="outline" onClick={resetBackup} className="col-span-2">
                  <KeyRound className="w-3 h-3 mr-1" /> Reset Backup Code
                </Button>
                <Button size="sm" variant="outline" onClick={deleteUser} className="col-span-2 border-destructive/30 text-destructive">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className="text-foreground font-mono text-xs truncate">{value}</p>
    </div>
  );
}
