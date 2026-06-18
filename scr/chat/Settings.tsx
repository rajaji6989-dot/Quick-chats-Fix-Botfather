import { useState, useRef } from 'react';
import { ArrowLeft, Camera, Copy, Check, Eye, EyeOff, LogOut, Pencil, Lock } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import PremiumLockModal from './PremiumLockModal';
import UserBadge from './UserBadge';

interface SettingsProps {
  profile: any;
  onBack: () => void;
  onProfileUpdate: () => void;
  onSignOut?: () => void;
}

export default function Settings({ profile, onBack, onProfileUpdate, onSignOut }: SettingsProps) {
  const [uploading, setUploading] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [showLock, setShowLock] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleAvatarClick = () => {
    if (!profile?.is_premium) { setShowLock(true); return; }
    fileRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Image must be under 2MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${profile.user_id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Upload failed', variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', profile.user_id);

    onProfileUpdate();
    setUploading(false);
    toast({ title: 'Profile picture updated!' });
  };

  const handleSaveName = async () => {
    await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('user_id', profile.user_id);
    onProfileUpdate();
    setEditingName(false);
    toast({ title: 'Display name updated!' });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(profile.backup_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-chat-header border-b border-border">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Profile</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-md mx-auto p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <Avatar className="w-28 h-28">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                <AvatarFallback className="bg-primary/20 text-primary text-4xl font-bold">
                  {profile?.username?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handleAvatarClick}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
              >
                {profile?.is_premium ? <Camera className="w-4 h-4 text-primary-foreground" /> : <Lock className="w-4 h-4 text-primary-foreground" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </div>
            <div className="text-center flex items-center gap-1.5 justify-center">
              <p className="text-lg font-semibold text-foreground">@{profile?.username}</p>
              <UserBadge badge={profile?.badge} size="sm" />
            </div>
          </div>
          {showLock && <PremiumLockModal feature="Set your profile picture" onClose={() => setShowLock(false)} />}

          {/* Display Name */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground text-sm">Display Name</h3>
              {!editingName && (
                <button onClick={() => setEditingName(true)} className="text-primary hover:text-primary/80">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="h-10 bg-secondary border-0 rounded-lg text-sm text-foreground"
                  maxLength={30}
                  autoFocus
                />
                <Button onClick={handleSaveName} size="sm" className="bg-primary hover:bg-primary/90 rounded-lg">
                  Save
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {profile?.display_name || 'Not set — tap edit to add your name'}
              </p>
            )}
          </div>

          {/* Backup Code */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground text-sm">Backup Code</h3>
              <button onClick={() => setShowCode(!showCode)} className="text-muted-foreground hover:text-foreground">
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {showCode && (
              <div className="animate-fade-in">
                <p className="text-xs text-destructive mb-2">⚠️ Keep this code private. Anyone with it can access your account.</p>
                <div className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                  <span className="font-mono text-lg tracking-[0.2em] text-foreground">{profile?.backup_code}</span>
                  <button onClick={handleCopyCode} className="text-muted-foreground hover:text-foreground">
                    {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-medium text-foreground text-sm">Your QR Code</h3>
            <div className="flex justify-center py-2">
              <div className="bg-white rounded-xl p-3">
                <QRCodeSVG
                  value={`${window.location.origin}/?u=${encodeURIComponent(profile?.username || '')}`}
                  size={140}
                  bgColor="#ffffff"
                  fgColor="#0b141a"
                  level="M"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">Friends can scan this to chat with you</p>
          </div>

          {/* Account Info */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="font-medium text-foreground text-sm">Account Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username</span>
                <span className="text-foreground">@{profile?.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span className="text-foreground">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Sign Out */}
          {onSignOut && (
            <Button
              onClick={onSignOut}
              variant="outline"
              className="w-full h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
