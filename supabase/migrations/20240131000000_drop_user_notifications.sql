-- Remove user_notifications table created by mistake (from another project).
-- LevelUp uses public.notifications (references public.users), not auth.users.
DROP TABLE IF EXISTS public.user_notifications;
