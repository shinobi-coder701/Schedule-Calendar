
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  meeting_link text NOT NULL,
  company_name text,
  company_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO anon, authenticated;
GRANT ALL ON public.schedules TO service_role;

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view schedules"
  ON public.schedules FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert schedules"
  ON public.schedules FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete schedules"
  ON public.schedules FOR DELETE
  USING (true);

CREATE INDEX schedules_scheduled_at_idx ON public.schedules(scheduled_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
