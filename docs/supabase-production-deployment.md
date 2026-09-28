# Supabase production deployment

The production backend is the Supabase project `mytbjkchvfybhyqcynnl`.

The GitHub Actions workflow in `.github/workflows/supabase-deploy.yml` keeps the production database migrations and Edge Functions synchronized with `main`.

## Required GitHub repository secrets

Add these under **Settings → Secrets and variables → Actions**:

- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token with access to the project.
- `SUPABASE_DB_URL`: the production PostgreSQL connection string for project `mytbjkchvfybhyqcynnl`. Keep the database password inside this secret; never commit it.

After the secrets exist, merging Supabase changes into `main` automatically:

1. applies all unapplied files in `supabase/migrations` in order;
2. deploys every Edge Function under `supabase/functions`;
3. uses `supabase/config.toml` to keep the production project and JWT settings consistent.

The workflow deliberately does not store any Supabase secret in the repository.
