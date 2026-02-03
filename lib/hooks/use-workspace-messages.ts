'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/components/theme-provider';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface WorkspaceMessage {
  id: string;
  workspace_id: string;
  author_id: string;
  content: string;
  message_type: 'text' | 'system';
  created_at: string;
  updated_at?: string;
  author?: {
    id: string;
    name: string;
    role?: string;
  };
}

async function resolveAuthorName(
  supabase: ReturnType<typeof createClient>,
  authorId: string
): Promise<{ id: string; name: string; role?: string }> {
  const { data: a } = await supabase
    .from('athletes')
    .select('id, first_name, last_name')
    .eq('id', authorId)
    .maybeSingle();
  if (a) {
    const name = `${(a as { first_name?: string; last_name?: string }).first_name || ''} ${(a as { first_name?: string; last_name?: string }).last_name || ''}`.trim();
    if (name) return { id: authorId, name, role: 'athlete' };
  }
  const { data: y } = await supabase
    .from('youth_wrestlers')
    .select('id, first_name, last_name')
    .eq('id', authorId)
    .maybeSingle();
  if (y) {
    const name = `${(y as { first_name?: string; last_name?: string }).first_name || ''} ${(y as { first_name?: string; last_name?: string }).last_name || ''}`.trim();
    if (name) return { id: authorId, name };
  }
  const { data: u } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', authorId)
    .maybeSingle();
  if (u) {
    const ur = u as { id: string; email?: string; role?: string };
    return {
      id: authorId,
      name: ur.email?.split('@')[0] || 'User',
      role: ur.role,
    };
  }
  return { id: authorId, name: 'User' };
}

function buildAuthorMap(
  messages: Array<{ author_id: string }>,
  authorMap: Map<string, { id: string; name: string; role?: string }>
): string[] {
  const need = messages
    .map((m) => m.author_id)
    .filter((id) => id && !authorMap.has(id));
  return [...new Set(need)];
}

export function useWorkspaceMessages(workspaceId: string) {
  const tenant = useTenant();
  const supabase = useMemo(() => createClient(tenant.slug), [tenant.slug]);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const resolveAuthors = useCallback(
    async (
      rawMessages: Array<{
        id: string;
        workspace_id: string;
        author_id: string;
        content: string;
        message_type?: string;
        created_at: string;
        updated_at?: string;
      }>
    ): Promise<WorkspaceMessage[]> => {
      const authorMap = new Map<string, { id: string; name: string; role?: string }>();
      const ids = buildAuthorMap(rawMessages, authorMap);
      for (const id of ids) {
        const author = await resolveAuthorName(supabase, id);
        authorMap.set(id, author);
      }
      return rawMessages.map((m) => ({
        ...m,
        message_type: (m.message_type === 'system' ? 'system' : 'text') as 'text' | 'system',
        author: authorMap.get(m.author_id),
      }));
    },
    [supabase]
  );

  useEffect(() => {
    if (!workspaceId) return;

    let channel: RealtimeChannel;

    async function fetchMessages() {
      try {
        setError(null);
        const { data: raw, error: fetchError } = await supabase
          .from('workspace_messages')
          .select('id, workspace_id, author_id, content, message_type, created_at, updated_at')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;
        const list = (raw || []) as Array<{
          id: string;
          workspace_id: string;
          author_id: string;
          content: string;
          message_type?: string;
          created_at: string;
          updated_at?: string;
        }>;
        const withAuthors = await resolveAuthors(list);
        setMessages(withAuthors);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load messages'));
        setMessages([]);
      } finally {
        setLoading(false);
      }
    }

    fetchMessages();

    channel = supabase
      .channel(`workspace-messages:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workspace_messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            workspace_id: string;
            author_id: string;
            content: string;
            message_type?: string;
            created_at: string;
            updated_at?: string;
          };
          const author = await resolveAuthorName(supabase, row.author_id);
          const msg: WorkspaceMessage = {
            id: row.id,
            workspace_id: row.workspace_id,
            author_id: row.author_id,
            content: row.content,
            message_type: row.message_type === 'system' ? 'system' : 'text',
            created_at: row.created_at,
            updated_at: row.updated_at,
            author,
          };
          setMessages((prev) => [...prev, msg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, resolveAuthors, supabase]);

  return { messages, loading, error };
}
