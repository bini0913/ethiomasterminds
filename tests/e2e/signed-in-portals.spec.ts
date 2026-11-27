import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const testPassword = process.env.CI_TEST_PASSWORD ?? 'Local-Only-Test-Password-2026!';

const portals = [
  { label: 'student', email: 'ci-student@masterminds.test', path: '/school/student' },
  { label: 'teacher', email: 'ci-teacher@masterminds.test', path: '/school/teacher' },
  { label: 'admin', email: 'ci-admin@masterminds.test', path: '/admin' },
  { label: 'school manager', email: 'ci-manager@masterminds.test', path: '/school/manager' },
  { label: 'finance', email: 'ci-finance@masterminds.test', path: '/school/finance' },
  { label: 'parent', email: 'ci-parent@masterminds.test', path: '/school/parent' },
  { label: 'Super Admin', email: 'ci-super-admin@masterminds.test', path: '/super-admin' },
  { label: 'Extreme Admin', email: 'ci-extreme-admin@masterminds.test', path: '/root-control-portal-9xA7' },
  { label: 'Academic Director', email: 'ci-academic-director@masterminds.test', path: '/school/admin' },
  { label: 'KG Division Director', email: 'ci-kg-director@masterminds.test', path: '/school/admin' },
  { label: 'Elementary Division Director', email: 'ci-elementary-director@masterminds.test', path: '/school/admin' },
  { label: 'Middle School Division Director', email: 'ci-middle-director@masterminds.test', path: '/school/admin' },
  { label: 'High School Division Director', email: 'ci-high-school-director@masterminds.test', path: '/school/admin' },
] as const;

test.skip(!supabaseUrl || !supabaseKey, 'Signed-in portal tests require the isolated local Supabase CI environment.');

async function authenticateAs(page: Page, email: string) {
  const client = createClient(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: testPassword });
  if (error || !data.session) {
    throw new Error(`CI sign-in failed for ${email}: ${error?.message ?? 'No session returned'}`);
  }

  // Match the storage key used by the app's Supabase client for this local URL.
  const storageKey = `sb-${new URL(supabaseUrl!).hostname.split('.')[0]}-auth-token`;
  await page.addInitScript(
    ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
    { key: storageKey, session: data.session },
  );
}

for (const portal of portals) {
  test(`signed-in ${portal.label} portal loads with its real role and school data`, async ({ page }) => {
    test.setTimeout(45_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await authenticateAs(page, portal.email);
    await page.goto(portal.path, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname === portal.path, { timeout: 25_000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 25_000 });
    await expect.poll(async () => (await page.locator('body').innerText()).trim().length).toBeGreaterThan(40);
    expect(pageErrors, `Unexpected browser errors in ${portal.label} portal`).toEqual([]);
  });
}

test('student account is denied access to the Admin portal', async ({ page }) => {
  test.setTimeout(45_000);
  await authenticateAs(page, 'ci-student@masterminds.test');
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => url.pathname === '/', { timeout: 25_000 });
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });
});


const notificationRoles = [
  { label: 'student', email: 'ci-student@masterminds.test' },
  { label: 'teacher', email: 'ci-teacher@masterminds.test' },
  { label: 'admin', email: 'ci-admin@masterminds.test' },
  { label: 'finance', email: 'ci-finance@masterminds.test' },
  { label: 'parent', email: 'ci-parent@masterminds.test' },
  { label: 'Super Admin', email: 'ci-super-admin@masterminds.test' },
  { label: 'Extreme Admin', email: 'ci-extreme-admin@masterminds.test' },
] as const;

for (const role of notificationRoles) {
  test(`${role.label} can open the notification inbox and preferences`, async ({ page }) => {
    test.setTimeout(45_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await authenticateAs(page, role.email);
    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname === '/notifications', { timeout: 25_000 });
    await expect(page.getByText('Notification inbox')).toBeVisible({ timeout: 25_000 });

    await page.goto('/notification-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname === '/notification-settings', { timeout: 25_000 });
    await expect(page.getByText('Push notifications')).toBeVisible({ timeout: 25_000 });
    expect(pageErrors, `Unexpected browser errors in ${role.label} notification flows`).toEqual([]);
  });
}

test('Extreme Admin executive workspace exposes Part 1 and Part 3 sections across desktop, tablet and mobile', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await authenticateAs(page, 'ci-extreme-admin@masterminds.test');
  const sections = [
    { nav: /Accounts & access/, heading: 'Accounts and access', content: 'Create and assign a school account' },
    { nav: /Super Admin/, heading: 'Single Super Admin' },
    { nav: /School network/, heading: 'School network' },
    { nav: /Money & growth/, heading: 'Business performance', content: 'Separate platform finance from school-fee collections.' },
    { nav: /Platform controls/, heading: 'Global controls & security' },
    { nav: /System health/, heading: 'System health & resilience', content: 'Live connectivity checks' },
    { nav: /Reports & flags/, heading: 'Reports & flags' },
    { nav: /Support & escalations/, heading: 'Support & escalations' },
    { nav: /Announcements/, heading: 'Platform announcements', content: 'Create announcement' },
    { nav: /Privacy requests/, heading: 'Privacy & account requests' },
    { nav: /Audit history/, heading: 'Audit history' },
  ];

  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/root-control-portal-9xA7', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Executive control center' })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText('All registered users')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText('Student accounts', { exact: true })).toBeVisible();

    for (const section of sections) {
      if (viewport.width < 1024) {
        await page.getByRole('button', { name: 'Open administration navigation' }).click();
      }
      await page.getByRole('button', { name: section.nav }).click();
      await expect(page.getByRole('heading', { name: section.heading })).toBeVisible();
      if (section.content) await expect(page.getByText(section.content)).toBeVisible();
    }
  }

  expect(pageErrors, 'Unexpected browser errors in Extreme Admin desktop/tablet/mobile workspace').toEqual([]);
});

test('Super Admin network workspace exposes its live workflows across desktop, tablet and mobile', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await authenticateAs(page, 'ci-super-admin@masterminds.test');
  const sections = [
    { label: /Overview Network pulse/, content: 'Network school directory' },
    { label: /Schools Register and oversee/, content: 'Register a school' },
    { label: /People Staff and memberships/, content: 'People and school memberships' },
    { label: /Analytics School performance/, content: 'School performance' },
    { label: /Finance Read-only oversight/, content: 'Network finance oversight' },
    { label: /Audit history Recorded changes/, content: 'Network audit history' },
    { label: /Settings Network identity/, content: 'Network identity' },
  ];

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/super-admin', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Network command center')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText('Network-scoped access')).toBeVisible();
    await expect(page.getByText('Owner access')).toHaveCount(0);

    for (const section of sections) {
      if (viewport.width < 1024) {
        await page.getByRole('button', { name: 'Open administration navigation' }).click();
      }
      await page.getByRole('button', { name: section.label }).click();
      await expect(page.getByText(section.content, { exact: false })).toBeVisible();
    }

    if (viewport.width < 1024) {
      await page.getByRole('button', { name: 'Open administration navigation' }).click();
    }
    await page.getByRole('button', { name: /People Staff and memberships/ }).click();
    await page.getByRole('button', { name: 'All schools' }).click();
    await expect(page.getByText('People and school memberships')).toBeVisible();
    await expect(page.getByText('Global account status is separate')).toBeVisible();

    if (viewport.width < 1024) {
      await page.getByRole('button', { name: 'Open administration navigation' }).click();
    }
    await page.getByRole('button', { name: /Schools Register and oversee/ }).click();
    await expect(page.getByText('Assign an existing account')).toBeVisible();

    if (viewport.width < 1024) {
      await page.getByRole('button', { name: 'Open administration navigation' }).click();
    }
    await page.getByRole('button', { name: /Finance Read-only oversight/ }).click();
    await expect(page.getByText('Recent school invoices')).toBeVisible();
    await expect(page.getByText('Pending finance follow-ups')).toBeVisible();
  }

  expect(pageErrors, 'Unexpected browser errors in Super Admin desktop/tablet/mobile workspace').toEqual([]);
});

test('Super Admin is denied access to the Extreme Admin owner route', async ({ page }) => {
  test.setTimeout(45_000);
  await authenticateAs(page, 'ci-super-admin@masterminds.test');
  await page.goto('/root-control-portal-9xA7', { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => url.pathname === '/', { timeout: 25_000 });
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Executive control center' })).toHaveCount(0);
});
