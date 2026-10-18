-- 7. EVENT SETTINGS
CREATE TABLE IF NOT EXISTS public.event_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    final_hours_open BOOLEAN NOT NULL DEFAULT false,
    team_qr_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for event_settings
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage event settings
CREATE POLICY "Admins can manage event settings"
ON public.event_settings
FOR ALL TO authenticated
USING (public.is_admin());
