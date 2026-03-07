-- Allow parents to create and own private groups (invite-only).
-- Only runs if public.messaging_groups exists (created by 20240139000000_messaging_groups.sql).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messaging_groups') THEN
    -- Add parent_id and make athlete_id nullable
    ALTER TABLE public.messaging_groups
      ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE public.messaging_groups
      ALTER COLUMN athlete_id DROP NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.messaging_groups'::regclass AND conname = 'messaging_groups_one_owner') THEN
      ALTER TABLE public.messaging_groups
        ADD CONSTRAINT messaging_groups_one_owner CHECK (athlete_id IS NOT NULL OR parent_id IS NOT NULL);
    END IF;

    CREATE INDEX IF NOT EXISTS idx_messaging_groups_parent ON public.messaging_groups(parent_id);

    -- RLS: parent can select groups they're in (member) or own (parent_id)
    DROP POLICY IF EXISTS "messaging_groups_select_member" ON public.messaging_groups;
    CREATE POLICY "messaging_groups_select_member"
      ON public.messaging_groups FOR SELECT TO authenticated
      USING (
        athlete_id = auth.uid()
        OR parent_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.messaging_group_members m WHERE m.group_id = id AND m.user_id = auth.uid())
      );

    CREATE POLICY "messaging_groups_insert_parent"
      ON public.messaging_groups FOR INSERT TO authenticated
      WITH CHECK (parent_id = auth.uid());

    CREATE POLICY "messaging_groups_update_parent"
      ON public.messaging_groups FOR UPDATE TO authenticated
      USING (parent_id = auth.uid())
      WITH CHECK (parent_id = auth.uid());

    CREATE POLICY "messaging_groups_delete_parent"
      ON public.messaging_groups FOR DELETE TO authenticated
      USING (parent_id = auth.uid());

    -- Trigger: add owner as admin and create general channel (owner = athlete_id or parent_id)
    CREATE OR REPLACE FUNCTION public.messaging_group_after_insert()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $fn$
    DECLARE
      owner_id UUID;
    BEGIN
      owner_id := COALESCE(NEW.athlete_id, NEW.parent_id);
      IF owner_id IS NOT NULL THEN
        INSERT INTO public.messaging_group_members (group_id, user_id, role)
        VALUES (NEW.id, owner_id, 'admin');
      END IF;
      INSERT INTO public.messaging_channels (group_id, name, position)
      VALUES (NEW.id, 'general', 0);
      RETURN NEW;
    END;
    $fn$;

    -- Channels: allow parent to insert channel for their group
    DROP POLICY IF EXISTS "messaging_channels_insert_coach" ON public.messaging_channels;
    CREATE POLICY "messaging_channels_insert_owner"
      ON public.messaging_channels FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.messaging_groups g
          WHERE g.id = group_id AND (g.athlete_id = auth.uid() OR g.parent_id = auth.uid())
        )
      );

    -- Group members: parent can manage members of their group
    DROP POLICY IF EXISTS "messaging_group_members_select" ON public.messaging_group_members;
    CREATE POLICY "messaging_group_members_select"
      ON public.messaging_group_members FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND (g.athlete_id = auth.uid() OR g.parent_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM public.messaging_group_members m WHERE m.group_id = messaging_group_members.group_id AND m.user_id = auth.uid())
      );
    CREATE POLICY "messaging_group_members_insert_parent"
      ON public.messaging_group_members FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.parent_id = auth.uid())
      );
    CREATE POLICY "messaging_group_members_delete_parent"
      ON public.messaging_group_members FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.parent_id = auth.uid())
      );

    -- Group kids: parent can add/remove kids in their group
    DROP POLICY IF EXISTS "messaging_group_kids_select" ON public.messaging_group_kids;
    CREATE POLICY "messaging_group_kids_select"
      ON public.messaging_group_kids FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND (g.athlete_id = auth.uid() OR g.parent_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM public.messaging_group_members m WHERE m.group_id = messaging_group_kids.group_id AND m.user_id = auth.uid())
      );
    CREATE POLICY "messaging_group_kids_insert_parent"
      ON public.messaging_group_kids FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.parent_id = auth.uid())
      );
    CREATE POLICY "messaging_group_kids_delete_parent"
      ON public.messaging_group_kids FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND g.parent_id = auth.uid())
      );

    -- Channels select: include parent-owned groups
    DROP POLICY IF EXISTS "messaging_channels_select" ON public.messaging_channels;
    CREATE POLICY "messaging_channels_select"
      ON public.messaging_channels FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.messaging_group_members m WHERE m.group_id = messaging_channels.group_id AND m.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.messaging_groups g WHERE g.id = group_id AND (g.athlete_id = auth.uid() OR g.parent_id = auth.uid()))
      );

    -- Channel messages: allow parent-owned group members to read/write
    DROP POLICY IF EXISTS "messaging_channel_messages_select" ON public.messaging_channel_messages;
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
          WHERE c.id = channel_id AND (g.athlete_id = auth.uid() OR g.parent_id = auth.uid())
        )
      );
    DROP POLICY IF EXISTS "messaging_channel_messages_insert" ON public.messaging_channel_messages;
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
            WHERE c.id = channel_id AND (g.athlete_id = auth.uid() OR g.parent_id = auth.uid())
          )
        )
      );
  END IF;
END $$;
