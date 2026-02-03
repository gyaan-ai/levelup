'use client';

import { useState, useEffect, useCallback } from 'react';

export type Workspace = {
  id: string;
  parent_id: string;
  youth_wrestler_id: string;
  athlete_id: string;
  status?: string;
  created_at: string;
  updated_at?: string;
  last_activity_at?: string | null;
  total_sessions?: number;
  youth_wrestlers?: { id: string; first_name?: string; last_name?: string };
  athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string | null };
};

export function useWorkspace(athleteId: string | undefined, coachId: string | undefined) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(!!athleteId && !!coachId);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!athleteId || !coachId) {
      setWorkspace(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces?athleteId=${encodeURIComponent(athleteId)}&coachId=${encodeURIComponent(coachId)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch workspace');
      }
      const data = await res.json();
      setWorkspace(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch workspace');
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [athleteId, coachId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { workspace, loading, error, refetch };
}

export function useMyWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch workspaces');
      }
      const data = await res.json();
      setWorkspaces(data.workspaces ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch workspaces');
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { workspaces, loading, error, refetch };
}
