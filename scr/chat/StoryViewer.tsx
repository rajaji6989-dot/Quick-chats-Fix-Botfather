import { useEffect, useRef, useState } from 'react';
import { X, Eye, Trash2, Music } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { markViewed, getStoryViewers, reactToStory, deleteStory } from '@/lib/stories';
import { useToast } from '@/hooks/use-toast';
import UserBadge from './UserBadge';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  groups: any[];
  startIndex: number;
  currentUserId: string;
  onClose: () => void;
}

const STORY_DURATION = 5000;
const REACTIONS = ['❤️', '🔥', '😂', '😮', '👏'];

export default function StoryViewer({ groups, startIndex, currentUserId, onClose }: Props) {
  const [groupIdx, setGroupIdx] = useState(startIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const startRef = useRef<number>(Date.now());
  const rafRef = useRef<number>();
  const { toast } = useToast();

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const isOwn = group?.user_id === currentUserId;

  useEffect(() => {
    if (!story) return;
    markViewed(story.id, currentUserId, group?.user_id).catch(() => {});
    setProgress(0);
    startRef.current = Date.now();
  }, [story?.id, currentUserId, group?.user_id]);

  useEffect(() => {
    if (!story || paused || showViewers) return;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(100, (elapsed / STORY_DURATION) * 100);
      setProgress(p);
      if (p >= 100) {
        next();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [story?.id, paused, showViewers]);

  const next = () => {
    if (storyIdx + 1 < group.stories.length) setStoryIdx(storyIdx + 1);
    else if (groupIdx + 1 < groups.length) { setGroupIdx(groupIdx + 1); setStoryIdx(0); }
    else onClose();
  };
  const prev = () => {
    if (storyIdx > 0) setStoryIdx(storyIdx - 1);
    else if (groupIdx > 0) { setGroupIdx(groupIdx - 1); setStoryIdx(groups[groupIdx - 1].stories.length - 1); }
  };

  const handleViewers = async () => {
    setShowViewers(true);
    const v = await getStoryViewers(story.id);
    setViewers(v);
  };

  const handleReact = (emoji: string) => {
    reactToStory(story.id, currentUserId, emoji);
    toast({ title: `Reacted ${emoji}` });
  };

  const handleDelete = async () => {
    await deleteStory(story.id);
    toast({ title: 'Story deleted' });
    onClose();
  };

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-30 px-2 pt-2 flex gap-1">
        {group.stories.map((_: any, i: number) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: i < storyIdx ? '100%' : i === storyIdx ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 z-30 flex items-center gap-2 px-3 pt-3">
        <Avatar className="w-9 h-9 border border-white/30">
          {group.profile?.avatar_url && <AvatarImage src={group.profile.avatar_url} />}
          <AvatarFallback>{group.profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-white truncate">@{group.profile?.username}</span>
            <UserBadge badge={group.profile?.badge} size="xs" />
          </div>
          <span className="text-[10px] text-white/70">{formatDistanceToNow(new Date(story.created_at))} ago</span>
        </div>
        <button disabled className="p-1.5 text-white/40" title="Coming Soon">
          <Music className="w-4 h-4" />
        </button>
        {isOwn && (
          <button onClick={handleDelete} className="p-1.5 text-white/80 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button onClick={onClose} className="p-1.5 text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image */}
      <div
        className="flex-1 flex items-center justify-center relative"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        <img src={story.image_url} alt="story" className="max-h-full max-w-full object-contain" />
        {/* Tap zones */}
        <button onClick={prev} className="absolute left-0 top-0 bottom-0 w-1/3" aria-label="prev" />
        <button onClick={next} className="absolute right-0 top-0 bottom-0 w-1/3" aria-label="next" />
      </div>

      {/* Bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-3 pb-6 bg-gradient-to-t from-black/80 to-transparent">
        {!isOwn && (
          <div className="flex justify-center gap-3 mb-3">
            {REACTIONS.map(e => (
              <button key={e} onClick={() => handleReact(e)} className="text-2xl hover:scale-125 active:scale-90 transition">
                {e}
              </button>
            ))}
          </div>
        )}
        {isOwn && (
          <button onClick={handleViewers} className="flex items-center gap-2 text-white text-sm">
            <Eye className="w-4 h-4" />
            <span>Viewers</span>
          </button>
        )}
      </div>

      {/* Viewers sheet */}
      {showViewers && (
        <div className="absolute inset-0 z-40 bg-background/95 flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Viewers ({viewers.length})</h3>
            <button onClick={() => setShowViewers(false)} className="text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {viewers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No viewers yet</div>
            ) : viewers.map((v, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
                <Avatar className="w-10 h-10">
                  {v.avatar_url && <AvatarImage src={v.avatar_url} />}
                  <AvatarFallback>{v.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-foreground truncate">@{v.username}</span>
                    <UserBadge badge={v.badge} size="xs" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(v.at))} ago</span>
                </div>
                {v.emoji && (
                  <span className="text-xl ml-2 animate-fade-in" title="Reacted">{v.emoji}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
