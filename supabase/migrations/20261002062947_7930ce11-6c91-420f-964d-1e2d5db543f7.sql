CREATE TABLE public.capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  domain text NOT NULL DEFAULT 'general',
  instructions text NOT NULL DEFAULT '',
  keywords text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'DRAFT',
  validated boolean NOT NULL DEFAULT false,
  is_core boolean NOT NULL DEFAULT false,
  sha256 text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.capabilities TO anon, authenticated;
GRANT ALL ON public.capabilities TO service_role;
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view capabilities" ON public.capabilities FOR SELECT USING (true);

CREATE TABLE public.upgrade_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement text NOT NULL,
  status text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  capability_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.upgrade_runs TO anon, authenticated;
GRANT ALL ON public.upgrade_runs TO service_role;
ALTER TABLE public.upgrade_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view upgrade runs" ON public.upgrade_runs FOR SELECT USING (true);

INSERT INTO public.capabilities (name, description, domain, keywords, status, validated, is_core) VALUES
('web_research','Web par research aur saboot jama karna','research','{research,search,web,internet}','ACTIVE',true,true),
('monetization_planning','Platform rules ke mutabiq kamai wala plan','research','{earning,monetization,rpm,money}','ACTIVE',true,true),
('script_writing','3-scene script kisi bhi zubaan mein','development','{script,story,narration}','ACTIVE',true,true),
('video_generation','Scene se video banana, reference photos ke saath','multimodal','{video,image,photo,reel}','ACTIVE',true,true);