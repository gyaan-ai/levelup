-- Join policy: who can join and how (everyone pays in the app)
-- public = anyone can discover and pay & register
-- private = no one else can join (only creator's participants)
-- invite_only = need link, then pay & register

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS join_policy TEXT DEFAULT 'private'
  CHECK (join_policy IN ('public', 'private', 'invite_only'));

COMMENT ON COLUMN public.sessions.join_policy IS 'public: anyone can pay & register; private: no one else; invite_only: need link then pay & register';
