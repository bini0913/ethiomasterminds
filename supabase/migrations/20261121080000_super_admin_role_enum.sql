-- Add the distinct Super Admin role in its own committed migration.
-- PostgreSQL cannot use a newly added enum value until this migration commits.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
