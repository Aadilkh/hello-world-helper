ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'youtube',
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS niche text,
  ADD COLUMN IF NOT EXISTS monetization jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS research jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ref_image_paths text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS voice_note text,
  ADD COLUMN IF NOT EXISTS command text;