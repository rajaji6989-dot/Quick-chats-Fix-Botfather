import { useEffect, useState } from 'react';
import { adminCall } from '@/lib/admin';
import { toast } from 'sonner';
import { Sparkles, Save, Loader2 } from 'lucide-react';

export default function AdminAI() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.0-flash');
  const [enabled, setEnabled] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminCall('get_ai_settings');
        const settings: { key: string; value: string }[] = res?.settings || [];
        const get = (k: string) => settings.find((s) => s.key === k)?.value || '';
        setApiKey(get('gemini_api_key'));
        setModel(get('gemini_model') || 'gemini-2.0-flash');
        setEnabled((settings.find((s) => s.key === 'khushi_enabled')?.value ?? 'true') !== 'false');
        setAvatarUrl(get('khushi_avatar_url'));
        setDisplayName(get('khushi_display_name') || 'ᴋʜᴜsɪ');
      } catch (e: any) {
        toast.error('Failed to load AI settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminCall('set_ai_settings', {
        gemini_api_key: apiKey.trim(),
        gemini_model: model.trim(),
        khushi_enabled: enabled,
        khushi_avatar_url: avatarUrl.trim(),
        khushi_display_name: displayName.trim() || 'ᴋʜᴜsɪ',
      });
      toast.success('AI settings saved');
    } catch (e: any) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (next: boolean) => {
    setEnabled(next);
    try {
      await adminCall('set_ai_settings', { khushi_enabled: next });
      toast.success(next ? 'ᴋʜᴜsɪ enabled for everyone' : 'ᴋʜᴜsɪ hidden from users');
    } catch {
      toast.error('Failed to update');
      setEnabled(!next);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-violet-500" />
        <h2 className="text-xl font-semibold">ᴋʜᴜsɪ AI Settings</h2>
      </div>
      <p className="text-sm text-muted-foreground">Manage Gemini API key, model, and visibility of the AI assistant.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      ) : (
        <div className="space-y-4 bg-card border border-border rounded-2xl p-4">
          {/* Visibility toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary">
            <div>
              <p className="text-sm font-medium">Show ᴋʜᴜsɪ to all users</p>
              <p className="text-[11px] text-muted-foreground">When off, the floating AI button is hidden everywhere.</p>
            </div>
            <button
              onClick={() => toggleEnabled(!enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-violet-500' : 'bg-muted-foreground/30'}`}
              aria-label="Toggle Khushi"
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Gemini API Key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="AIza..."
              className="w-full px-3 py-2 bg-secondary rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[11px] text-muted-foreground">Get one from Google AI Studio (aistudio.google.com).</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-secondary rounded-xl text-sm outline-none"
            >
              <option value="gemini-2.0-flash">gemini-2.0-flash (recommended)</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">ᴋʜᴜsɪ Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ᴋʜᴜsɪ"
              className="w-full px-3 py-2 bg-secondary rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">ᴋʜᴜsɪ Profile Photo (URL)</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-secondary rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            {avatarUrl && (
              <img src={avatarUrl} alt="preview" className="w-16 h-16 rounded-full object-cover border border-border mt-2" />
            )}
            <p className="text-[11px] text-muted-foreground">Paste a public image URL. Yeh chat ke andar aur sidebar mein dikhega.</p>
          </div>
          <button
            onClick={save}
            disabled={saving || !apiKey.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      )}
    </div>
  );
}
