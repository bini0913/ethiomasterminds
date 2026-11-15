-- Add the role enum value in its own committed migration.
-- PostgreSQL cannot use a newly added enum value until the transaction commits.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'extreme_admin';
