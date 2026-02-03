'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';

interface ActionItemFormProps {
  workspaceId: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function ActionItemForm({ workspaceId, onSaved, onCancel }: ActionItemFormProps) {
  const [task, setTask] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  async function handleSubmit() {
    if (!task.trim() || task.trim().length < 3) {
      alert('Task is required (min 3 characters)');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: task.trim(),
          description: description.trim() || null,
          due_date: dueDate ? dueDate.toISOString() : null,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create action item');
      }
      setTask('');
      setDescription('');
      setDueDate(undefined);
      onSaved?.();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create action item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="task">Task *</Label>
        <Input
          id="task"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="e.g., Practice low single entries for 10 minutes daily"
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-2"
          placeholder="Add details, progress expectations, or links to reference videos."
        />
      </div>

      <div>
        <Label>Due Date (optional)</Label>
        <Button
          variant="outline"
          className="w-full justify-start mt-2"
          type="button"
          onClick={() => setShowCalendar((prev) => !prev)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
        </Button>
        {showCalendar && (
          <div className="mt-2 rounded-lg border bg-background p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Select due date</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCalendar(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={(date) => {
                setDueDate(date);
                setShowCalendar(false);
              }}
              initialFocus
            />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={saving || task.trim().length < 3} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {saving ? 'Saving...' : 'Assign Homework'}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
