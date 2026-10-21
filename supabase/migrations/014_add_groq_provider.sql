-- Adds Groq as the secondary AI provider. Existing Grok settings are retained
-- for audit history but are no longer used by the backend.
ALTER TABLE public.ai_provider_settings
  DROP CONSTRAINT IF EXISTS ai_provider_settings_provider_check;

ALTER TABLE public.ai_provider_settings
  ADD CONSTRAINT ai_provider_settings_provider_check
  CHECK (provider IN ('gemini', 'grok', 'groq'));

INSERT INTO public.ai_provider_settings (provider, enabled, priority, model)
VALUES ('groq', true, 2, 'openai/gpt-oss-120b')
ON CONFLICT (provider) DO NOTHING;
