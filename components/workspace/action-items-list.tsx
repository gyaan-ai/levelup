'use client';

import { useState } from 'react';
import { useActionItems } from '@/lib/hooks/use-action-items';
import { Card, CardContent } from '@/components/ui/card';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Loader2, Calendar } from 'lucide-react';

interface ActionItemsListProps {
  workspaceId: string;
  canComplete?: boolean;
}

export function ActionItemsList({ workspaceId, canComplete = false }: ActionItemsListProps) {
  const { items, loading, error } = useActionItems(workspaceId);
  const [completingId, setCompletingId] = useState<string | null>(null);

  async function toggleComplete(itemId: string, currentStatus: 'pending' | 'completed') {
    if (!canComplete) return;
    setCompletingId(itemId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/actions/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentStatus === 'completed' ? 'pending' : 'completed' }),
      });
      if (!res.ok) throw new Error();
    } catch {
      alert('Failed to update action item');
    } finally {
      setCompletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load action items
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Circle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
        No homework assigned yet.
      </div>
    );
  }

  const pendingItems = items.filter((item) => item.status === 'pending');
  const completedItems = items.filter((item) => item.status === 'completed');

  return (
    <div className="space-y-6">
      {pendingItems.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            To Do ({pendingItems.length})
          </h3>
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                onToggle={toggleComplete}
                canComplete={canComplete}
                completingId={completingId}
              />
            ))}
          </div>
        </section>
      )}

      {completedItems.length > 0 && (
        <section className="opacity-70">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Completed ({completedItems.length})
          </h3>
          <div className="space-y-3">
            {completedItems.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                onToggle={toggleComplete}
                canComplete={canComplete}
                completingId={completingId}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface ActionItemCardProps {
  item: {
    id: string;
    content: string;
    description: string | null;
    status: 'pending' | 'completed';
    due_date: string | null;
    completed_at: string | null;
  };
  onToggle: (id: string, status: 'pending' | 'completed') => void;
  canComplete: boolean;
  completingId: string | null;
}

function ActionItemCard({ item, onToggle, canComplete, completingId }: ActionItemCardProps) {
  const isCompleted = item.status === 'completed';
  const overdue = item.due_date && !isCompleted && isPast(new Date(item.due_date));

  return (
    <Card className={overdue ? 'border-destructive/40' : ''}>
      <CardContent className="p-4 flex gap-3">
        <button
          onClick={() => canComplete && onToggle(item.id, item.status)}
          disabled={!canComplete || completingId === item.id}
          className="mt-1"
        >
          {completingId === item.id ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-accent" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground hover:text-accent" />
          )}
        </button>
        <div className="flex-1">
          <p className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
            {item.content}
          </p>
          {item.description && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
              {item.description}
            </p>
          )}

          {item.due_date && (
            <div
              className={`flex items-center gap-1 text-xs mt-2 ${
                overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
              }`}
            >
              <Calendar className="h-3 w-3" />
              {overdue ? 'Overdue: ' : 'Due: '}
              {format(new Date(item.due_date), 'MMM d, yyyy')}
              {!isCompleted && ` (${formatDistanceToNow(new Date(item.due_date), { addSuffix: true })})`}
            </div>
          )}

          {isCompleted && item.completed_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Completed {formatDistanceToNow(new Date(item.completed_at), { addSuffix: true })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
