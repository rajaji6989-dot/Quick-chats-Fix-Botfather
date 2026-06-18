import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getStoriesGrouped, uploadStory } from '@/lib/stories';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import UserBadge from './UserBadge';

interface Props {
  currentUserId: string;
  currentProfile: any;
  onOpen: (groups: any[], index: number) => void;
}

export default function StoriesBar({ currentUserId, currentProfile, onOpen }: Props) {
  const [groups, setGroups] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = async () => {
    const g = await getStoriesGrouped(currentUserId);
    setGroups(g);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`stories-${Math.random().toString(36).slice(2)}`);
    setTimeout(() => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, load).subscribe();
    }, 0);
    return () => { supabase.removeChannel(ch); };
  }, [currentUserId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast({ title: 'Max 10MB', variant: 'destructive' }); return; }
    setUploading(true);
    const r = await uploadStory(currentUserId, file);
    setUploading(false);
    if (!r.ok) toast({ title: r.error || 'Upload failed', variant: 'destructive' });
    else { toast({ title: 'Story posted!' }); load(); }
    e.target.value = '';
  };

  const myGroup = groups.find(g => g.user_id === currentUserId);
  const others = groups.filter(g => g.user_id !== currentUserId);

  const ringClass = (g: any) => {
    if (g.profile?.badge === 'premium' || g.profile?.is_premium) return 'p-[2.5px] bg-gradient-to-tr from-yellow-300 via-yellow-500 to-amber-600 animate-spin-slow shadow-[0_0_10px_rgba(234,179,8,0.6)]';
    if (g.profile?.badge === 'verified') return 'p-[2.5px] bg-gradient-to-tr from-blue-400 to-cyan-500 shadow-[0_0_8px_rgba(29,161,242,0.6)]';
    if (g.allViewed) return 'p-[2px] bg-muted-foreground/40';
    return 'p-[2.5px] bg-gradient-to-tr from-pink-500 via-fuchsia-500 to-purple-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]';
  };

  return (
    <div className="bg-card border-b border-border/50 px-2 py-3">
      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1">
        {/* My story */}
        <button
          onClick={() => myGroup ? onOpen([myGroup, ...others], 0) : fileRef.current?.click()}
          className="flex flex-col items-center gap-1 flex-shrink-0 w-16"
        >
          <div className="relative">
            <div className={`rounded-full ${myGroup ? ringClass(myGroup) : 'p-[2px] bg-muted-foreground/30'}`}>
              <div className="bg-card rounded-full p-[2px]">
                <Avatar className="w-14 h-14">
                  {currentProfile?.avatar_url && <AvatarImage src={currentProfile.avatar_url} />}
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                    {currentProfile?.username?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              disabled={uploading}
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary border-2 border-card flex items-center justify-center shadow-md"
            >
              <Plus className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </div>
          <span className="text-[10px] text-foreground truncate w-full text-center">Your Story</span>
        </button>

        {others.map((g, i) => (
          <button
            key={g.user_id}
            onClick={() => onOpen([myGroup, ...others].filter(Boolean), myGroup ? i + 1 : i)}
            className="flex flex-col items-center gap-1 flex-shrink-0 w-16"
          >
            <div className={`rounded-full ${ringClass(g)}`}>
              <div className="bg-card rounded-full p-[2px]">
                <Avatar className="w-14 h-14">
                  {g.profile?.avatar_url && <AvatarImage src={g.profile.avatar_url} />}
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                    {g.profile?.username?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center inline-flex items-center justify-center gap-0.5">
              <span className="truncate">@{g.profile?.username}</span>
              <UserBadge badge={g.profile?.badge || (g.profile?.is_premium ? 'premium' : null)} size="xs" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
