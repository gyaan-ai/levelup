-- One-time: set only Cam, Liam, and Sabino as live (visible on Browse).
-- Run in Supabase SQL Editor (production). All other coaches become hidden.
--
-- Cam  = stinsoncameron440@gmail.com
-- Liam = liampatrickhickey@gmail.com
-- Sabino = sabinoportella@gmail.com

-- First hide everyone
UPDATE public.athletes SET active = false;

-- Then activate only these three (by user id)
UPDATE public.athletes
SET active = true
WHERE id IN (
  'a005817d-7d29-495f-a6f0-425db1972f32',  -- Cam
  '094c9330-0cd5-4ff2-a83f-4c4ae9b0796a',  -- Liam
  '47446177-80e9-4381-9de0-8fd5abb15cb0'   -- Sabino
);
