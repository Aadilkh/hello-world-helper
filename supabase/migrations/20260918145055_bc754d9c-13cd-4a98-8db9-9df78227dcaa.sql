CREATE TABLE public.video_projects (
  id uuid primary key default gen_random_uuid(),
  idea text not null,
  language text not null default 'urdu',
  aspect_ratio text not null default '9:16',
  quality text not null default 'draft',
  title text,
  hook text,
  scenes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

CREATE TABLE public.video_clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects(id) on delete cascade,
  scene_index int not null,
  prompt text not null,
  duration_seconds int not null default 8,
  job_id text,
  status text not null default 'pending',
  error text,
  resolution text not null default '360p',
  storage_path text,
  created_at timestamptz not null default now(),
  unique (project_id, scene_index)
);

CREATE INDEX idx_video_clips_project ON public.video_clips(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_projects TO anon, authenticated;
GRANT ALL ON public.video_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_clips TO anon, authenticated;
GRANT ALL ON public.video_clips TO service_role;

ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view projects" ON public.video_projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create projects" ON public.video_projects FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update projects" ON public.video_projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete projects" ON public.video_projects FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Anyone can view clips" ON public.video_clips FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create clips" ON public.video_clips FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update clips" ON public.video_clips FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete clips" ON public.video_clips FOR DELETE TO anon, authenticated USING (true);