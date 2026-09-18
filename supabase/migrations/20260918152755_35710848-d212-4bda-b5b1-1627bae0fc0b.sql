ALTER TABLE public.video_clips
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;