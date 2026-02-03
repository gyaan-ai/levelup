'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ActionItemForm } from './action-item-form';
import { ActionItemsList } from './action-items-list';

interface ActionItemsSectionProps {
  workspaceId: string;
  isCoach: boolean;
}

export function ActionItemsSection({ workspaceId, isCoach }: ActionItemsSectionProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Action Items</CardTitle>
            <CardDescription>
              {isCoach
                ? 'Assign homework for practice between sessions'
                : 'Complete the drills your coach assigns'}
            </CardDescription>
          </div>
          {isCoach && !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Assign Homework
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="mb-6 border rounded-lg p-4 bg-muted/40">
            <ActionItemForm
              workspaceId={workspaceId}
              onSaved={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        <ActionItemsList workspaceId={workspaceId} canComplete={!isCoach} />
      </CardContent>
    </Card>
  );
}
