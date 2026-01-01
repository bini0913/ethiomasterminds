-- Fix the access_codes check constraint to include manager
ALTER TABLE public.access_codes DROP CONSTRAINT IF EXISTS access_codes_code_type_check;
ALTER TABLE public.access_codes ADD CONSTRAINT access_codes_code_type_check 
  CHECK (code_type = ANY (ARRAY['teacher'::text, 'admin'::text, 'manager'::text]));

-- Insert default access codes if they don't exist
INSERT INTO public.access_codes (code, code_type, is_used)
SELECT 'TEACHER123', 'teacher', false
WHERE NOT EXISTS (SELECT 1 FROM public.access_codes WHERE code = 'TEACHER123');

INSERT INTO public.access_codes (code, code_type, is_used)
SELECT 'ADMIN456', 'admin', false
WHERE NOT EXISTS (SELECT 1 FROM public.access_codes WHERE code = 'ADMIN456');

INSERT INTO public.access_codes (code, code_type, is_used)
SELECT 'MANAGER789', 'manager', false
WHERE NOT EXISTS (SELECT 1 FROM public.access_codes WHERE code = 'MANAGER789');