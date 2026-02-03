'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { format } from 'date-fns';

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

interface SessionSummaryDisplayProps {
  summary: SessionSummary;
  sessionDate: string;
  sessionNumber?: number;
}

export function SessionSummaryDisplay({
  summary,
  sessionDate,
  sessionNumber,
}: SessionSummaryDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {sessionNumber ? `Session #${sessionNumber}` : 'Session Summary'} —{' '}
          {format(new Date(sessionDate), 'MMMM d, yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.focus_areas && summary.focus_areas.length > 0 && (
          <div>
            <p className="font-semibold text-sm text-muted-foreground mb-2">
              Focus Areas:
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.focus_areas.map((area) => (
                <span
                  key={area}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="font-semibold text-sm text-muted-foreground mb-2">
            What We Worked On:
          </p>
          <p className="text-foreground whitespace-pre-wrap">
            {summary.what_we_worked_on}
          </p>
        </div>

        {summary.progress_notes && (
          <div>
            <p className="font-semibold text-sm text-muted-foreground mb-2">
              Progress Notes:
            </p>
            <p className="text-foreground whitespace-pre-wrap">
              {summary.progress_notes}
            </p>
          </div>
        )}

        {summary.next_session_plan && (
          <div>
            <p className="font-semibold text-sm text-muted-foreground mb-2">
              Next Session Plan:
            </p>
            <p className="text-foreground whitespace-pre-wrap">
              {summary.next_session_plan}
            </p>
          </div>
        )}

        {(summary.overall_effort || summary.technical_progress) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
            {summary.overall_effort && (
              <div>
                <p className="font-semibold text-sm text-muted-foreground mb-1">
                  Overall Effort:
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Star
                      key={rating}
                      className={`h-5 w-5 ${
                        rating <= summary.overall_effort!
                          ? 'fill-accent text-accent'
                          : 'text-muted-foreground/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {summary.technical_progress && (
              <div>
                <p className="font-semibold text-sm text-muted-foreground mb-1">
                  Technical Progress:
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Star
                      key={rating}
                      className={`h-5 w-5 ${
                        rating <= summary.technical_progress!
                          ? 'fill-accent text-accent'
                          : 'text-muted-foreground/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
