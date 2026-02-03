-- Enhance workspace_actions with description, due dates, and status tracking

ALTER TABLE public.workspace_actions
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed'));

UPDATE public.workspace_actions
SET status = CASE WHEN completed THEN 'completed' ELSE 'pending' END
WHERE status IS DISTINCT FROM CASE WHEN completed THEN 'completed' ELSE 'pending' END;
