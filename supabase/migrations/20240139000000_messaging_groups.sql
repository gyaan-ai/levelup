-- Slack-style group messaging: coach creates groups (per kid or multi-kid), parents + coach in group.
-- DMs remain coach_inquiries. This adds: groups, channels (one per group), messages, reactions, edit support.

-- Groups: coach-owned; name e.g. "Ethan Smith" or "Practice Squad A"
CREATE TABLE IF NOT EXISTS public.messaging_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messaging_groups_athlete ON public.messaging_groups(athlete_id);

-- Who is in the group (coach + parents). Coach adds "kids" which adds their parent(s).
CREATE TABLE IF NOT EXISTS public.messaging_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.messaging_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_messaging_group_members_group ON public.messaging_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_messaging_group_members_user ON public.messaging_group_members(user_id);

-- Which youth wrestlers (kids) are linked to this group. Adding a kid adds their parent to members.
CREATE TABLE IF NOT EXISTS public.messaging_group_kids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.messaging_groups(id) ON DELETE CASCADE,
  youth_wrestler_id UUID NOT NULL REFERENCES public.youth_wrestlers(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, youth_wrestler_id)
);

CREATE INDEX IF NOT EXISTS idx_messaging_group_kids_group ON public.messaging_group_kids(group_id);

-- One channel per group (e.g. "general") for simplicity.
CREATE TABLE IF NOT EXISTS public.messaging_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.messaging_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'general',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messaging_channels_group ON public.messaging_channels(group_id);

-- Messages in a channel. Support edit via edited_at.
CREATE TABLE IF NOT EXISTS public.messaging_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.messaging_channels(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  attachment_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_messaging_channel_messages_channel ON public.messaging_channel_messages(channel_id, created_at DESC);

-- Emoji reactions on messages.
CREATE TABLE IF NOT EXISTS public.messaging_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messaging_channel_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_messaging_message_reactions_message ON public.messaging_message_reactions(message_id);

-- Read state per user per channel (for unread badges).
CREATE TABLE IF NOT EXISTS public.messaging_channel_read (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.messaging_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel_id)
);

-- RLS
ALTER TABLE public.messaging_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_group_kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_channel_read ENABLE ROW LEVEL SECURITY;

-- Groups: coach (athlete_id) can manage; members can select
CREATE POLICY "messaging_groups_select_member"
  ON public.messaging_groups FOR SELECT TO authenticated
  USING (
    athlete_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.messaging_group_members m WHERE m.group_id = id AND m.user_id = auth.uid())
  );
CREATE POLICY "messaging_groups_insert_coach"
  ON public.messaging_groups FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "messaging_groups_update_coach"
  ON public.messaging_groups FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid());
CREATE POLICY "messaging_groups_delete_coach"
  ON public.messaging_groups FOR DELETE TO authenticated
  USING (athlete_id = auth.uid());

-- Group members: only group members or coach can see; coach can insert/delete
CREATE POLICY "messaging_group_members_select"
  ON public.messaging_group_members FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.athlete_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.messaging_group_members m WHERE m.group_id = messaging_group_members.group_id AND m.user_id = auth.uid())
  );
CREATE POLICY "messaging_group_members_insert_coach"
  ON public.messaging_group_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.athlete_id = auth.uid())
  );
CREATE POLICY "messaging_group_members_delete_coach"
  ON public.messaging_group_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.athlete_id = auth.uid())
  );

-- Group kids: same as members (visible to group; coach manages)
CREATE POLICY "messaging_group_kids_select"
  ON public.messaging_group_kids FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.athlete_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.messaging_group_members m WHERE m.group_id = messaging_group_kids.group_id AND m.user_id = auth.uid())
  );
CREATE POLICY "messaging_group_kids_insert_coach"
  ON public.messaging_group_kids FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.athlete_id = auth.uid())
  );
CREATE POLICY "messaging_group_kids_delete_coach"
  ON public.messaging_group_kids FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.athlete_id = auth.uid())
  );

-- Channels: visible to group members
CREATE POLICY "messaging_channels_select"
  ON public.messaging_channels FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.messaging_group_members m WHERE m.group_id = messaging_channels.group_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.athlete_id = auth.uid())
  );
CREATE POLICY "messaging_channels_insert_coach"
  ON public.messaging_channels FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.athlete_id = auth.uid())
  );

-- Channel messages: members can select/insert; author can update (edit)
CREATE POLICY "messaging_channel_messages_select"
  ON public.messaging_channel_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messaging_channels c
      JOIN public.messaging_group_members m ON m.group_id = c.group_id
      WHERE c.id = channel_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.messaging_channels c
      JOIN public.messaging_groups g ON g.id = c.group_id
      WHERE c.id = channel_id AND g.athlete_id = auth.uid()
    )
  );
CREATE POLICY "messaging_channel_messages_insert"
  ON public.messaging_channel_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.messaging_channels c
        JOIN public.messaging_group_members m ON m.group_id = c.group_id
        WHERE c.id = channel_id AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.messaging_channels c
        JOIN public.messaging_groups g ON g.id = c.group_id
        WHERE c.id = channel_id AND g.athlete_id = auth.uid()
      )
    )
  );
CREATE POLICY "messaging_channel_messages_update_author"
  ON public.messaging_channel_messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Reactions: members can select/insert/delete own
CREATE POLICY "messaging_message_reactions_select"
  ON public.messaging_message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messaging_channel_messages msg
      JOIN public.messaging_channels c ON c.id = msg.channel_id
      JOIN public.messaging_group_members m ON m.group_id = c.group_id
      WHERE msg.id = message_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.messaging_channel_messages msg
      JOIN public.messaging_channels c ON c.id = msg.channel_id
      JOIN public.messaging_groups g ON g.id = c.group_id
      WHERE msg.id = message_id AND g.athlete_id = auth.uid()
    )
  );
CREATE POLICY "messaging_message_reactions_insert"
  ON public.messaging_message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messaging_channel_messages msg
      JOIN public.messaging_channels c ON c.id = msg.channel_id
      JOIN public.messaging_group_members m ON m.group_id = c.group_id
      WHERE msg.id = message_id AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "messaging_message_reactions_delete"
  ON public.messaging_message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Channel read: users manage own read state
CREATE POLICY "messaging_channel_read_all"
  ON public.messaging_channel_read FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- When a group is created, add coach as admin member and create one "general" channel
CREATE OR REPLACE FUNCTION public.messaging_group_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.messaging_group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.athlete_id, 'admin');
  INSERT INTO public.messaging_channels (group_id, name, position)
  VALUES (NEW.id, 'general', 0);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messaging_group_after_insert ON public.messaging_groups;
CREATE TRIGGER messaging_group_after_insert
  AFTER INSERT ON public.messaging_groups
  FOR EACH ROW EXECUTE FUNCTION public.messaging_group_after_insert();

-- Realtime: in Supabase Dashboard → Database → Replication, add messaging_channel_messages to supabase_realtime

COMMENT ON TABLE public.messaging_groups IS 'Coach-created groups for group chat (e.g. per kid or multi-kid).';
COMMENT ON TABLE public.messaging_group_kids IS 'Youth wrestlers linked to a group; their parent is added as a member.';
