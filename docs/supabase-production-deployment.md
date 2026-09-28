# Supabase production deployment

The production backend is the Supabase project `mytbjkchvfybhyqcynnl`.

## Edge Functions

The GitHub Actions workflow in `.github/workflows/supabase-deploy.yml` automatically deploys every function under `supabase/functions` when function code changes reach `main`.

Add this GitHub repository secret:

- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token with access to the production project.

The workflow uses the production project ID directly and the checked-in `supabase/config.toml`.

## Database migrations

The production database was created from a reconciled baseline rather than from the repository's original migration history. Because of that history drift, **do not run a blind `supabase db push` against production** until the migration history has been reconciled.

The repository contains idempotent reconciliation migrations for the current production schema. They can be reviewed and applied through the project's controlled Supabase migration process.

Never commit a database password, service-role key, or access token.
