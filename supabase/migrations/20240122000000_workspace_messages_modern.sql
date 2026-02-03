-- Modern messaging: edit/delete support, emoji reactions

-- Add updated_at for edit tracking
ALTER TABLE public.workspace_messages
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Emoji reactions table
CREATE TABLE IF NOT EXISTS public.workspace_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.workspace_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.workspace_message_reactions(message_id);

ALTER TABLE public.workspace_message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions on messages they can see
DROP POLICY IF EXISTS "Users can view message reactions" ON public.workspace_message_reactions;
CREATE POLICY "Users can view message reactions"
  ON public.workspace_message_reactions FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM public.workspace_messages m
      JOIN public.workspaces w ON w.id = m.workspace_id
      WHERE w.parent_id = auth.uid()
         OR w.athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Users can add reactions to messages they can see
DROP POLICY IF EXISTS "Users can add reactions" ON public.workspace_message_reactions;
CREATE POLICY "Users can add reactions"
  ON public.workspace_message_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    message_id IN (
      SELECT m.id FROM public.workspace_messages m
      JOIN public.workspaces w ON w.id = m.workspace_id
      WHERE w.parent_id = auth.uid()
         OR w.athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Users can remove their own reactions
DROP POLICY IF EXISTS "Users can remove own reactions" ON public.workspace_message_reactions;
CREATE POLICY "Users can remove own reactions"
  ON public.workspace_message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Allow users to update their own messages
DROP POLICY IF EXISTS "Users can update own messages" ON public.workspace_messages;
CREATE POLICY "Users can update own messages"
  ON public.workspace_messages FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Allow users to delete their own messages
DROP POLICY IF EXISTS "Users can delete own messages" ON public.workspace_messages;
CREATE POLICY "Users can delete own messages"
  ON public.workspace_messages FOR DELETE
  USING (author_id = auth.uid());

COMMENT ON TABLE public.workspace_message_reactions IS 'Emoji reactions on workspace messages';
