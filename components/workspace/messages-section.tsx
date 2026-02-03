'use client';

import { MessageList } from './message-list';
import { MessageInput } from './message-input';

interface MessagesSectionProps {
  workspaceId: string;
  currentUserId: string;
}

export function MessagesSection({ workspaceId, currentUserId }: MessagesSectionProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <MessageList workspaceId={workspaceId} currentUserId={currentUserId} />
      </div>
      <div className="border-t bg-background p-4 shrink-0">
        <MessageInput workspaceId={workspaceId} />
      </div>
    </div>
  );
}
