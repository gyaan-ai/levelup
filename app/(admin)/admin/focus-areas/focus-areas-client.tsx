'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FocusAreaRow = { id: string; name: string; sort_order: number };

export function FocusAreasClient({ initialList }: { initialList: FocusAreaRow[] }) {
  const [list, setList] = useState<FocusAreaRow[]>(initialList);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/focus-areas');
    if (res.ok) {
      const data = await res.json();
      setList(data.focusAreas ?? []);
    }
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/focus-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      setList((prev) => [...prev, { id: data.id, name: data.name, sort_order: data.sort_order }]);
      setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this topic? Sessions that use it will keep the text.')) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/focus-areas/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setList((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (row: FocusAreaRow) => {
    setEditingId(row.id);
    setEditName(row.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/focus-areas/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }
      setList((prev) => prev.map((r) => (r.id === editingId ? { ...r, name } : r)));
      setEditingId(null);
      setEditName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topics list</CardTitle>
        <CardDescription>Add a new topic or edit/remove existing ones.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="new-topic" className="sr-only">New topic</Label>
            <Input
              id="new-topic"
              placeholder="e.g. Neutral Re-Attacks"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading || !newName.trim()}>
            Add
          </Button>
        </form>
        <ul className="space-y-2">
          {list.map((row) => (
            <li key={row.id} className="flex items-center gap-2 py-2 border-b last:border-0">
              {editingId === row.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    disabled={loading}
                  />
                  <Button size="sm" onClick={handleSaveEdit} disabled={loading}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{row.name}</span>
                  <Button size="sm" variant="outline" onClick={() => startEdit(row)} disabled={loading}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(row.id)} disabled={loading}>
                    Remove
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">No topics yet. Add one above, or run the migration to seed the default list.</p>
        )}
      </CardContent>
    </Card>
  );
}
