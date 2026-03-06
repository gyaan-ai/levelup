'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { MapPin, Plus, ArrowLeft } from 'lucide-react';

export type Facility = {
  id: string;
  name: string;
  school: string;
  address?: string | null;
  created_at?: string;
};

type Props = {
  initialFacilities: Facility[];
};

export function FacilitiesClient({ initialFacilities }: Props) {
  const [facilities, setFacilities] = useState<Facility[]>(initialFacilities);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [address, setAddress] = useState('');

  const fetchFacilities = async () => {
    const res = await fetch('/api/admin/facilities');
    if (!res.ok) return;
    const data = await res.json();
    setFacilities(data.facilities ?? []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !school.trim()) {
      setError('Name and school are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), school: school.trim(), address: address.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create facility');
        setLoading(false);
        return;
      }
      setFacilities((prev) => [...prev, data.facility]);
      setName('');
      setSchool('');
      setAddress('');
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-muted-foreground">Back to dashboard</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Add facility
          </CardTitle>
          <CardDescription>
            New facilities appear in the global list. Coaches select from this list only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Tar Heel Wrestling Club"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school">School / program</Label>
                <Input
                  id="school"
                  placeholder="e.g. UNC, NC State"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address (optional)</Label>
              <Input
                id="address"
                placeholder="Street, city, state"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              {loading ? 'Adding…' : 'Add facility'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All facilities</CardTitle>
          <CardDescription>
            {facilities.length} location{facilities.length !== 1 ? 's' : ''}. Coaches choose from this list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {facilities.length === 0 ? (
            <p className="text-muted-foreground">No facilities yet. Add one above.</p>
          ) : (
            <ul className="divide-y divide-border">
              {facilities.map((f) => (
                <li key={f.id} className="py-3 flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{f.name}</span>
                  <span className="text-muted-foreground">— {f.school}</span>
                  {f.address && <span className="text-sm text-muted-foreground w-full">{f.address}</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
