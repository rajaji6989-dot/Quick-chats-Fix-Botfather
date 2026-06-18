import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { adminCall } from '@/lib/admin';
import { useToast } from '@/hooks/use-toast';

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const { toast } = useToast();

  const load = async () => {
    const r = await adminCall('list_plans');
    setPlans(r.plans || []);
  };
  useEffect(() => { load(); }, []);

  const update = (id: string, k: string, v: any) => setPlans(plans.map(p => p.id === id ? { ...p, [k]: v } : p));

  const save = async (p: any) => {
    await adminCall('save_plan', p);
    toast({ title: 'Saved' });
    load();
  };

  const remove = async (id: string) => {
    await adminCall('delete_plan', { id });
    toast({ title: 'Deleted' });
    load();
  };

  const add = async () => {
    await adminCall('save_plan', { name: 'New', duration_days: 30, price_inr: 49, active: true });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Premium Plans</h1>
          <p className="text-sm text-muted-foreground">Edit pricing & duration</p>
        </div>
        <Button onClick={add} className="bg-yellow-500 hover:bg-yellow-600 text-black"><Plus className="w-4 h-4 mr-1" /> Add</Button>
      </div>

      <div className="grid gap-3">
        {plans.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={p.name} onChange={(e) => update(p.id, 'name', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Days</label>
                <Input type="number" value={p.duration_days} onChange={(e) => update(p.id, 'duration_days', +e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Price (₹)</label>
                <Input type="number" value={p.price_inr} onChange={(e) => update(p.id, 'price_inr', +e.target.value)} />
              </div>
              <div className="flex items-end gap-1">
                <Button size="sm" onClick={() => save(p)} className="flex-1">Save</Button>
                <Button size="sm" variant="outline" onClick={() => remove(p.id)} className="text-destructive"><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
            <label className="text-xs flex items-center gap-2 text-foreground">
              <input type="checkbox" checked={p.active} onChange={(e) => update(p.id, 'active', e.target.checked)} /> Active
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
