-- Admin-managed AI providers. API keys are encrypted by the backend before storage.
CREATE TABLE IF NOT EXISTS public.ai_provider_settings (
  provider TEXT PRIMARY KEY CHECK (provider IN ('gemini', 'grok')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  priority SMALLINT NOT NULL DEFAULT 1 CHECK (priority IN (1, 2)),
  api_key_ciphertext TEXT,
  model TEXT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_provider_settings (provider, enabled, priority, model)
VALUES ('gemini', true, 1, 'gemini-3.7-flash'), ('grok', false, 2, 'grok-4-fast-reasoning')
ON CONFLICT (provider) DO NOTHING;
