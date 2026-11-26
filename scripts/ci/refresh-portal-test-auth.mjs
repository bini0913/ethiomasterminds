import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.CI_SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.CI_TEST_PASSWORD ?? 'Local-Only-Test-Password-2026!';

if (!url || !serviceRoleKey) {
  throw new Error('The isolated local Supabase URL and service-role key are required.');
}

const users = [
  ['00000000-0000-4000-8000-000000000001', 'ci-student@masterminds.test'],
  ['00000000-0000-4000-8000-000000000002', 'ci-teacher@masterminds.test'],
  ['00000000-0000-4000-8000-000000000003', 'ci-admin@masterminds.test'],
  ['00000000-0000-4000-8000-000000000004', 'ci-manager@masterminds.test'],
  ['00000000-0000-4000-8000-000000000005', 'ci-finance@masterminds.test'],
  ['00000000-0000-4000-8000-000000000006', 'ci-parent@masterminds.test'],
  ['00000000-0000-4000-8000-000000000007', 'ci-super-admin@masterminds.test'],
  ['00000000-0000-4000-8000-000000000008', 'ci-extreme-admin@masterminds.test'],
  ['00000000-0000-4000-8000-000000000009', 'ci-academic-director@masterminds.test'],
  ['00000000-0000-4000-8000-000000000010', 'ci-kg-director@masterminds.test'],
  ['00000000-0000-4000-8000-000000000011', 'ci-elementary-director@masterminds.test'],
  ['00000000-0000-4000-8000-000000000012', 'ci-middle-director@masterminds.test'],
  ['00000000-0000-4000-8000-000000000013', 'ci-high-school-director@masterminds.test'],
];

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const [id, email] of users) {
  const { data, error } = await supabase.auth.admin.updateUserById(id, {
    password,
    email,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Could not set local CI credentials for ${email}: ${error?.message ?? 'user not returned'}`);
  }
}

console.log(`Configured local Supabase Auth credentials for ${users.length} isolated CI users.`);
