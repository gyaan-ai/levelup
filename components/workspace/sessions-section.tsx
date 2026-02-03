'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { SessionSummaryForm } from './session-summary-form';
import { SessionSummaryDisplay } from './session-summary-display';

interface SessionSummary {
  id: string;
  focus_areas: string[];
  what_we_worked_on: string;
  progress_notes: string | null;
  next_session_plan: string | null;
  overall_effort: number | null;
  technical_progress: number | null;
  created_at: string;
}

interface Session {
  id: string;
  scheduled_datetime: string;
  status: string;
  summary: SessionSummary | null;
}

export function SessionsSection({
  workspaceId,
  sessions,
  isCoach,
  onRefresh,
}: {
  workspaceId: string;
  sessions: Array<Session>;
  isCoach: boolean;
  onRefresh?: () => void;
}) {
  const [writingSummaryFor, setWritingSummaryFor] = useState<string | null>(null);

  if (!sessions.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 text-muted-foreground/60 mb-3" />
          <p className="text-lg font-medium">No sessions yet</p>
          <p className="text-sm mt-1">Session summaries will appear here after each session.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session, index) => {
        const sessionNumber = sessions.length - index;
        const hasSummary = Boolean(session.summary);
        const isWriting = writingSummaryFor === session.id;

        return (
          <Card key={session.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-lg">
                  Session #{sessionNumber} — {format(new Date(session.scheduled_datetime), 'MMM d, yyyy')}
                </CardTitle>
                {isCoach && !isWriting && (
                  <Button
                    variant={hasSummary ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => setWritingSummaryFor(session.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {hasSummary ? 'Edit Summary' : 'Write Summary'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isWriting ? (
                <div className="space-y-4">
                  <SessionSummaryForm
                    workspaceId={workspaceId}
                    sessionId={session.id}
                    onSaved={() => {
                      setWritingSummaryFor(null);
                      onRefresh?.();
                    }}
                  />
                  <Button variant="ghost" onClick={() => setWritingSummaryFor(null)}>
                    Cancel
                  </Button>
                </div>
              ) : hasSummary ? (
                <SessionSummaryDisplay
                  summary={session.summary}
                  sessionDate={session.scheduled_datetime}
                  sessionNumber={sessionNumber}
                />
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                  <p className="text-sm">
                    {isCoach
                      ? 'No summary yet. Click "Write Summary" to document this session.'
                      : 'Coach has not written a summary for this session yet.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
