import { useEffect, useState } from 'react';
import { Users, CheckCircle, Crown, Wifi, UserPlus, Activity, Megaphone } from 'lucide-react';
import { adminCall } from '@/lib/admin';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

const cards = [
  { key: 'total', label: 'Total Users', icon: Users, color: 'from-blue-500 to-cyan-500', glow: 'rgba(59,130,246,0.4)' },
  { key: 'verified', label: 'Verified', icon: CheckCircle, color: 'from-cyan-500 to-blue-600', glow: 'rgba(29,161,242,0.4)' },
  { key: 'premium', label: 'Premium', icon: Crown, color: 'from-yellow-400 to-yellow-600', glow: 'rgba(234,179,8,0.4)' },
  { key: 'online', label: 'Online Now', icon: Wifi, color: 'from-green-500 to-emerald-600', glow: 'rgba(34,197,94,0.4)' },
  { key: 'today', label: 'New Today', icon: UserPlus, color: 'from-pink-500 to-fuchsia-600', glow: 'rgba(217,70,239,0.4)' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({});
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);

  const load = async () => {
    try { const r = await adminCall('stats'); setStats(r); } catch {}
    const { data: u } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, is_online, badge, created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    setRecentUsers(u || []);
    try {
      const r = await adminCall('list_broadcasts');
      setRecentBroadcasts((r.broadcasts || []).slice(0, 5));
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    const ch = supabase.channel(`admin-stats-${Math.random().toString(36).slice(2)}`);
    setTimeout(() => ch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, load)
      .subscribe(), 0);
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live activity • Auto-refreshes every 5s</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(c => {
          const I = c.icon;
          return (
            <div key={c.key} className="relative overflow-hidden rounded-2xl bg-card border border-border p-4 group hover:scale-[1.02] transition-transform"
              style={{ boxShadow: `0 0 30px ${c.glow}` }}>
              <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${c.color} opacity-20 blur-2xl group-hover:opacity-40 transition`} />
              <div className={`relative w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-lg`}>
                <I className="w-5 h-5 text-white" />
              </div>
              <p className="relative text-3xl font-bold text-foreground mt-3 tabular-nums">{stats[c.key] ?? '—'}</p>
              <p className="relative text-xs text-muted-foreground mt-1">{c.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">New Registrations</h3>
          </div>
          <div className="space-y-2">
            {recentUsers.length === 0 && <p className="text-sm text-muted-foreground">No users yet</p>}
            {recentUsers.map(u => (
              <div key={u.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/40">
                <div className="relative w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground overflow-hidden">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.username[0]?.toUpperCase()}
                  {u.is_online && <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 border border-card" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">@{u.username}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(u.created_at))} ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Recent Broadcasts</h3>
          </div>
          <div className="space-y-2">
            {recentBroadcasts.length === 0 && <p className="text-sm text-muted-foreground">No broadcasts yet</p>}
            {recentBroadcasts.map(b => (
              <div key={b.id} className="p-2 rounded-lg bg-secondary/40">
                <p className="text-sm text-foreground break-words line-clamp-2">{b.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(b.created_at))} ago</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
