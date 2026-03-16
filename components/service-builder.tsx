'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2, Users, User, UserCircle } from 'lucide-react';
import { COACH_REVENUE_FRACTION, GUILD_PERCENT_DISPLAY } from '@/lib/pricing';

const DURATIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1 hr 30 min' },
  { value: 120, label: '2 hr' },
] as const;

const SESSION_TYPES = [
  { value: 'private', label: 'Private (1:1)', icon: User, maxDefault: 1 },
  { value: 'partner', label: 'Partner (1:2)', icon: Users, maxDefault: 2 },
  { value: 'small_group', label: 'Small group', icon: UserCircle, maxDefault: 6 },
] as const;

type Service = {
  id: string;
  durationMinutes: number;
  sessionType: string;
  maxParticipants: number;
  parentPrice: number;
  athletePayout: number;
  displayOrder: number;
  active: boolean;
};

function formatDuration(m: number) {
  return DURATIONS.find((d) => d.value === m)?.label ?? `${m} min`;
}

function formatType(t: string) {
  return SESSION_TYPES.find((s) => s.value === t)?.label ?? t;
}

export type RecommendedRates = {
  oneOnOne: number;
  twoAthlete: number;
  groupRate: number;
};

type ServiceBuilderProps = {
  recommendedRates?: RecommendedRates;
};

export function ServiceBuilder({ recommendedRates }: ServiceBuilderProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newDuration, setNewDuration] = useState<number>(60);
  const [newType, setNewType] = useState<'private' | 'partner' | 'small_group'>('private');
  const [newMax, setNewMax] = useState(6);
  const [newPrice, setNewPrice] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const priceUpdateTimeout = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = async () => {
    try {
      const r = await fetch('/api/athletes/services');
      const data = await r.json();
      if (data.services) setServices(data.services);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addService = async () => {
    const price = parseFloat(newPrice);
    if (Number.isNaN(price) || price < 0) return;
    setAddError(null);
    setAdding(true);
    try {
      const r = await fetch('/api/athletes/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes: newDuration,
          sessionType: newType,
          maxParticipants: newType === 'small_group' ? newMax : undefined,
          parentPrice: price,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.service) {
        setServices((prev) => [...prev, data.service]);
        setNewPrice('');
        setAddError(null);
      } else {
        setAddError(data.error || 'Failed to add offering');
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add offering');
    } finally {
      setAdding(false);
    }
  };

  const updatePrice = (id: string, parentPrice: number) => {
    if (priceUpdateTimeout.current[id]) clearTimeout(priceUpdateTimeout.current[id]);
    priceUpdateTimeout.current[id] = setTimeout(async () => {
      setSaving(id);
      try {
        const r = await fetch(`/api/athletes/services/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentPrice }),
        });
        const data = await r.json();
        if (r.ok && data.service) {
          setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...data.service } : s)));
        }
      } finally {
        setSaving(null);
      }
      delete priceUpdateTimeout.current[id];
    }, 600);
  };

  const removeService = async (id: string) => {
    setSaving(id);
    try {
      const r = await fetch(`/api/athletes/services/${id}`, { method: 'DELETE' });
      if (r.ok) setServices((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Guild share: <strong>~{GUILD_PERCENT_DISPLAY}%</strong> of what the parent pays. You receive the rest. Set the price per person; for small groups, that’s the price per participant.
      </p>

      {services.length > 0 && (
        <ul className="space-y-3">
          {services.map((s) => (
            <li key={s.id}>
              <Card>
                <CardContent className="py-4 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatDuration(s.durationMinutes)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{formatType(s.sessionType)}</span>
                    {s.sessionType === 'small_group' && (
                      <span className="text-muted-foreground">(up to {s.maxParticipants})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Label htmlFor={`price-${s.id}`} className="text-muted-foreground shrink-0">Parent pays</Label>
                    <span className="shrink-0">$</span>
                    <Input
                      id={`price-${s.id}`}
                      type="number"
                      min={0}
                      step={0.01}
                      value={s.parentPrice}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v) && v >= 0) {
                          setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, parentPrice: v, athletePayout: Math.round(v * COACH_REVENUE_FRACTION * 100) / 100 } : x)));
                          updatePrice(s.id, v);
                        }
                      }}
                      disabled={saving === s.id}
                      className="w-24 h-8"
                    />
                    <span className="text-muted-foreground text-sm shrink-0">/person</span>
                  </div>
                  <div className="text-sm text-muted-foreground shrink-0">
                    You receive: <span className="font-medium text-accent">${s.athletePayout.toFixed(2)}</span>/person
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeService(s.id)}
                    disabled={saving === s.id}
                  >
                    {saving === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Add offering</CardTitle>
          <CardDescription>
            Duration, type, and price per person. You receive the rest after the guild share (~{GUILD_PERCENT_DISPLAY}%).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Duration</Label>
              <Select value={String(newDuration)} onValueChange={(v) => setNewDuration(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {newType === 'small_group' && (
            <div>
              <Label>Max in group</Label>
              <Input
                type="number"
                min={3}
                max={20}
                value={newMax}
                onChange={(e) => setNewMax(Math.min(20, Math.max(3, parseInt(e.target.value, 10) || 3)))}
              />
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Parent pays per person ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder={
                  recommendedRates
                    ? String(
                        newType === 'private'
                          ? recommendedRates.oneOnOne
                          : newType === 'partner'
                            ? Math.round(recommendedRates.twoAthlete / 2)
                            : recommendedRates.groupRate
                      )
                    : 'e.g. 60'
                }
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
            <Button onClick={addService} disabled={adding || !newPrice.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add
            </Button>
          </div>
          {recommendedRates && (
            <p className="text-sm text-muted-foreground">
              Recommended range:{' '}
              {newType === 'private' && `about $${recommendedRates.oneOnOne} for 1 hr private`}
              {newType === 'partner' && `about $${Math.round(recommendedRates.twoAthlete / 2)}/person for 1 hr (2 athletes)`}
              {newType === 'small_group' && `about $${recommendedRates.groupRate}/person for group sessions`}
            </p>
          )}
          {addError && (
            <p className="text-sm text-destructive" role="alert">
              {addError}
            </p>
          )}
          {newPrice.trim() && !Number.isNaN(parseFloat(newPrice)) && (
            <p className="text-sm text-muted-foreground">
              You’ll receive <span className="font-medium text-accent">${(parseFloat(newPrice) * COACH_REVENUE_FRACTION).toFixed(2)}</span>/person (Guild share ~{GUILD_PERCENT_DISPLAY}%).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
