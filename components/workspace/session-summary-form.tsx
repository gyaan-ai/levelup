'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Star } from 'lucide-react';

interface SessionSummaryFormProps {
  workspaceId: string;
  sessionId: string;
  onSaved?: () => void;
}

const FOCUS_OPTIONS = [
  'Hand fighting',
  'Low single',
  'High single',
  'Neutral position',
  'Top position',
  'Bottom position',
  'Chain wrestling',
  'Conditioning',
  'Technique refinement',
  'Match strategy',
];

export function SessionSummaryForm({
  workspaceId,
  sessionId,
  onSaved,
}: SessionSummaryFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [customFocus, setCustomFocus] = useState('');
  const [whatWeWorkedOn, setWhatWeWorkedOn] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [nextSessionPlan, setNextSessionPlan] = useState('');
  const [overallEffort, setOverallEffort] = useState<number | null>(null);
  const [technicalProgress, setTechnicalProgress] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSummary() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/summary`);
        if (res.ok) {
          const summary = await res.json();
          if (summary && isMounted) {
            setFocusAreas(summary.focus_areas || []);
            setWhatWeWorkedOn(summary.what_we_worked_on || '');
            setProgressNotes(summary.progress_notes || '');
            setNextSessionPlan(summary.next_session_plan || '');
            setOverallEffort(summary.overall_effort ?? null);
            setTechnicalProgress(summary.technical_progress ?? null);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadSummary();
    return () => {
      isMounted = false;
    };
  }, [workspaceId, sessionId]);

  async function handleSave() {
    if (!whatWeWorkedOn.trim() || whatWeWorkedOn.trim().length < 10) {
      alert('Please describe what you worked on (at least 10 characters)');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus_areas: focusAreas,
          what_we_worked_on: whatWeWorkedOn,
          progress_notes: progressNotes,
          next_session_plan: nextSessionPlan,
          overall_effort: overallEffort,
          technical_progress: technicalProgress,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save');
      }

      onSaved?.();
      alert('Session summary saved!');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save summary');
    } finally {
      setSaving(false);
    }
  }

  function toggleFocus(area: string) {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  function addCustomFocus() {
    const trimmed = customFocus.trim();
    if (trimmed && !focusAreas.includes(trimmed)) {
      setFocusAreas((prev) => [...prev, trimmed]);
      setCustomFocus('');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>Focus Areas (select all that apply)</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {FOCUS_OPTIONS.map((area) => (
            <button
              key={area}
              onClick={() => toggleFocus(area)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                focusAreas.includes(area)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
              type="button"
            >
              {area}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <Input
            placeholder="Add custom focus area..."
            value={customFocus}
            onChange={(e) => setCustomFocus(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomFocus();
              }
            }}
          />
          <Button onClick={addCustomFocus} variant="outline" size="sm" type="button">
            Add
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="worked-on">
          What We Worked On <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="worked-on"
          value={whatWeWorkedOn}
          onChange={(e) => setWhatWeWorkedOn(e.target.value)}
          placeholder="Describe the session in detail. What techniques did you cover? What drills did you do?"
          className="min-h-[120px] mt-2"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          {whatWeWorkedOn.trim().length} characters
        </p>
      </div>

      <div>
        <Label htmlFor="progress">Progress Notes (optional)</Label>
        <Textarea
          id="progress"
          value={progressNotes}
          onChange={(e) => setProgressNotes(e.target.value)}
          placeholder="How did they do? What improved? What needs more work?"
          className="min-h-[80px] mt-2"
        />
      </div>

      <div>
        <Label htmlFor="next-plan">Next Session Plan (optional)</Label>
        <Textarea
          id="next-plan"
          value={nextSessionPlan}
          onChange={(e) => setNextSessionPlan(e.target.value)}
          placeholder="What will you focus on next session?"
          className="min-h-[60px] mt-2"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <Label>Overall Effort (optional)</Label>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => setOverallEffort(rating)}
                className="p-2 hover:scale-110 transition-transform"
                type="button"
                aria-label={`Overall effort ${rating}`}
              >
                <Star
                  className={`h-6 w-6 ${
                    overallEffort && rating <= overallEffort
                      ? 'fill-accent text-accent'
                      : 'text-muted-foreground/40'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Technical Progress (optional)</Label>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => setTechnicalProgress(rating)}
                className="p-2 hover:scale-110 transition-transform"
                type="button"
                aria-label={`Technical progress ${rating}`}
              >
                <Star
                  className={`h-6 w-6 ${
                    technicalProgress && rating <= technicalProgress
                      ? 'fill-accent text-accent'
                      : 'text-muted-foreground/40'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving || whatWeWorkedOn.trim().length < 10}
        size="lg"
        className="w-full"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Session Summary'
        )}
      </Button>
    </div>
  );
}
