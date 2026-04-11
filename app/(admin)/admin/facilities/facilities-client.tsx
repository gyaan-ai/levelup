'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { BackLink } from '@/components/back-link';

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
  const [editing, setEditing] = useState<Facility | null>(null);
  const [editName, setEditName] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [deleting, setDeleting] = useState<Facility | null>(null);

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

  const openEdit = (f: Facility) => {
    setEditing(f);
    setEditName(f.name);
    setEditSchool(f.school);
    setEditAddress(f.address ?? '');
    setError(null);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editName.trim() || !editSchool.trim()) {
      setError('Name and school are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/facilities/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          school: editSchool.trim(),
          address: editAddress.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update facility');
        setLoading(false);
        return;
      }
      setFacilities((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...data.facility } : p)));
      setEditing(null);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/facilities/${deleting.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to delete facility');
        setLoading(false);
        setDeleting(null);
        return;
      }
      setFacilities((prev) => prev.filter((p) => p.id !== deleting.id));
      setDeleting(null);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <BackLink fallbackHref="/admin" label="Back to dashboard" />
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
                <li key={f.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground">— {f.school}</span>
                    {f.address && <span className="text-sm text-muted-foreground w-full">{f.address}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)} disabled={loading} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(f)} disabled={loading} title="Delete" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit facility</DialogTitle>
            <DialogDescription>Update name, school, or address.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. NC State Wrestling Facility" />
              </div>
              <div className="space-y-2">
                <Label>School / program</Label>
                <Input value={editSchool} onChange={(e) => setEditSchool(e.target.value)} placeholder="e.g. NC State" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address (optional)</Label>
              <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Street, city, state" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete facility</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleting?.name}&quot;? This will fail if any coach or session uses this facility.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleting(null); setError(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>{loading ? 'Deleting…' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
