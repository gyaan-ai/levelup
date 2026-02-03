'use client';

import { ActionItemForm } from './action-item-form';
import { ActionItemsList } from './action-items-list';

interface ActionItemsSectionProps {
  workspaceId: string;
  isCoach: boolean;
  showForm: boolean;
  onCloseForm: () => void;
  onRefresh?: () => void;
}

export function ActionItemsSection({
  workspaceId,
  isCoach,
  showForm,
  onCloseForm,
  onRefresh,
}: ActionItemsSectionProps) {
  return (
    <div className="space-y-6">
      {showForm && (
        <div className="border rounded-lg p-4 bg-muted/40">
          <ActionItemForm
            workspaceId={workspaceId}
            onSaved={() => {
              onCloseForm();
              onRefresh?.();
            }}
            onCancel={onCloseForm}
          />
        </div>
      )}
      <ActionItemsList workspaceId={workspaceId} canComplete={!isCoach} onStatusChange={onRefresh} />
    </div>
  );
}
