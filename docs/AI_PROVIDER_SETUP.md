# Master Minds AI provider setup (Groq)

Master Minds AI Edge Functions use Groq's OpenAI-compatible chat completions API. The API key must remain a Supabase Edge Function secret; never put it in Vite environment variables, Android assets, source code, or commit history.

## 1. Create a Groq API key

1. Open https://console.groq.com/ and sign in.
2. Open the API keys page and create a key for Master Minds.
3. Copy it once and keep it private. Do not paste it into GitHub issues, pull requests, or chat.

## 2. Add it to the existing Supabase project

Use the existing Master Minds Supabase project (project ref: `mytbjkchvfybhyqcynnl`):

1. Open the Supabase dashboard and select that project.
2. Open **Project Settings → Edge Functions → Secrets** (the exact menu label can vary).
3. Add a secret named `GROQ_API_KEY` with the Groq key as its value.
4. Save it. Do not add the secret to `.env` files committed to GitHub.

CLI alternative, if Supabase CLI is already configured for the existing project:

```sh
supabase secrets set GROQ_API_KEY=your_groq_key
```

Replace the placeholder locally; never commit the real key.

## 3. Deploy and test

After the code PR is merged, ensure the updated Edge Functions are deployed to the same Supabase project. Test AI Tutor first, then the hint/explanation helper, academic insights, study planner, Learning DNA analysis, parent insights, and Library AI.

The free Groq developer tier has model-specific rate limits and is not unlimited production capacity. Master Minds already applies per-user Edge Function rate limits; users should receive a retry-later message when the provider quota is exhausted.

## Data handling

Send only the minimum student context required for a response. Do not include passwords, access tokens, or unnecessary personally identifying information in prompts. Review Groq's current terms and data controls before production launch.
