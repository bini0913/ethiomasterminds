-- Add the finance role in its own committed migration. PostgreSQL cannot
-- use a newly-added enum value until the transaction adding it has committed.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
