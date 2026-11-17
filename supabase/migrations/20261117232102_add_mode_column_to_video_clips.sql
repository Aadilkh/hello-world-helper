/*
# Add mode column to video_clips

1. Changes
- Add `mode` column to `video_clips` table (text, default 'free').
- Tracks whether a clip was generated via 'free' (stock photos + TTS) or 'veo' (Google Veo API).
2. Security
- No RLS or policy changes — existing policies still apply.
*/

ALTER TABLE video_clips
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'free';
