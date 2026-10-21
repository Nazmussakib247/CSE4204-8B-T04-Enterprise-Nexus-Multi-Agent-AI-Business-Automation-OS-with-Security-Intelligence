-- Groq is the first fallback choice for Executive Agent responses.
UPDATE public.ai_provider_settings
SET priority = CASE provider WHEN 'groq' THEN 1 WHEN 'gemini' THEN 2 ELSE priority END
WHERE provider IN ('gemini', 'groq');
