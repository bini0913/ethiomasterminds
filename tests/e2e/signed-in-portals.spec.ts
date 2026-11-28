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
      await expect(page.getByRole('heading', { name: section.content, exact: false }).first()).toBeVisible();
    }

    if (viewport.width < 1024) {
      await page.getByRole('button', { name: 'Open administration navigation' }).click();
    }
    await page.getByRole('button', { name: /People Staff and memberships/ }).click();
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'All schools' }).click();
    await expect(page.getByText('People and school memberships')).toBeVisible();
    await expect(page.getByText('Global account status is separate')).toBeVisible();
    const accessSuspend = page.getByRole('button', { name: 'Suspend access', exact: true }).first();
    if (await accessSuspend.count()) {
      await accessSuspend.click();
      await expect(page.getByRole('heading', { name: 'Confirm membership status change' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Confirm change' })).toBeDisabled();
      await page.getByRole('button', { name: 'Cancel' }).click();
    }
    const legacyAdminRow = page.getByRole('row').filter({ hasText: /Legacy Admin role/ });
    if (await legacyAdminRow.count()) await expect(legacyAdminRow.getByRole('button')).toHaveCount(0);
    const staffSuspend = page.getByRole('button', { name: 'Suspend', exact: true }).first();
    if (await staffSuspend.count()) {
      await staffSuspend.click();
      await expect(page.getByRole('heading', { name: 'Confirm membership status change' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Confirm change' })).toBeDisabled();
      await page.getByRole('button', { name: 'Cancel' }).click();
    }

    if (viewport.width < 1024) {
      await page.getByRole('button', { name: 'Open administration navigation' }).click();
    }
    await page.getByRole('button', { name: /Schools Register and oversee/ }).click();
    await expect(page.getByText('Assign an existing account')).toBeVisible();
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Parent' }).click();
    await expect(page.getByText('Enrolled student usernames')).toBeVisible();
    const schoolSuspend = page.getByRole('button', { name: 'Suspend', exact: true }).first();
    if (await schoolSuspend.count()) {
      await schoolSuspend.click();
      await expect(page.getByRole('heading', { name: 'Confirm school status change' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Confirm change' })).toBeDisabled();
      await page.getByRole('button', { name: 'Cancel' }).click();
    }

    if (viewport.width < 1024) {
      await page.getByRole('button', { name: 'Open administration navigation' }).click();
    }
    await page.getByRole('button', { name: /Finance Read-only oversight/ }).click();
    await expect(page.getByRole('heading', { name: 'Recent school invoices', exact: false }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pending finance follow-ups', exact: false }).first()).toBeVisible();
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

test('School Manager Part 1 workflows are reachable across desktop, tablet and mobile', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');

  const sections = [
    { nav: 'Student Directory', heading: 'Student directory', content: 'Search by student name, username, school ID' },
    { nav: 'Staff Directory', heading: 'Staff directory', content: 'Review school staff memberships' },
    { nav: 'Teacher Assignments', heading: 'Teacher assignments', content: 'Create assignment' },
    { nav: 'School Structure', heading: 'School structure', content: 'Academic terms' },
    { nav: 'Manager Settings', heading: 'Manager settings', content: 'Attendance and parent notification policies' },
    { nav: 'School Audit', heading: 'School audit history', content: 'Audit events' },
    { nav: 'Leadership Team', heading: 'School leadership team', content: 'Grade-to-division mapping' },
  ];

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });

    for (const section of sections) {
      if (viewport.width < 1024) {
        await page.getByRole('button', { name: 'Open navigation' }).click();
      }
      await page.getByRole('button', { name: section.nav, exact: true }).click();
      await expect(page.getByRole('heading', { name: section.heading, exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(section.content, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
      if (section.nav === 'Teacher Assignments') await expect(page.getByText('Teacher assignment recommendations', { exact: true })).toBeVisible();
    }
  }

  expect(pageErrors, 'Unexpected browser errors in School Manager Part 1 desktop/tablet/mobile workflows').toEqual([]);
});

test('School Manager academic oversight is reachable on desktop, tablet and mobile', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Academic Management', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Academic management', exact: true })).toBeVisible();
    await expect(page.getByText('Academic scope', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Assessment oversight', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Subject coverage by section', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ethiopian textbook reference catalog', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Academic follow-up candidates', exact: true })).toBeVisible();
  }

  expect(pageErrors, 'Unexpected browser errors in School Manager academic oversight').toEqual([]);
});

test('School Manager curriculum and intervention workflows are reachable across devices', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Curriculum & Support', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Curriculum and academic support', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add curriculum unit', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Teaching delivery by class', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Academic intervention plans', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Academic audit history', exact: true })).toBeVisible();
  }
  expect(pageErrors, 'Unexpected browser errors in School Manager curriculum and intervention workflows').toEqual([]);
});

test('School Teacher curriculum delivery workspace is reachable', async ({ page }) => {
  test.setTimeout(45_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-teacher@masterminds.test');
  await page.goto('/school/teacher', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 25_000 });
  // The responsive SchoolPortalShell moves navigation into a drawer on tablet/mobile.
  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  await page.getByRole('button', { name: 'Curriculum Delivery', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Curriculum delivery', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My assigned curriculum units', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My class delivery history', exact: true })).toBeVisible();
  expect(pageErrors, 'Unexpected browser errors in School Teacher curriculum delivery').toEqual([]);
});

test('School Manager attendance oversight is reachable across desktop, tablet and mobile', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Attendance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Attendance & daily operations', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Filter attendance', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Attendance sessions', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Session details', exact: true })).toBeVisible();
  }
  expect(pageErrors, 'Unexpected browser errors in School Manager attendance oversight').toEqual([]);
});


test('School Manager timetable and calendar workflows are reachable across desktop, tablet and mobile', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Timetable & Calendar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Timetable & school calendar', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add timetable entry', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Weekly timetable', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Calendar events', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create calendar event', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'School calendar', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Operations audit', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Timetable and calendar audit', exact: true })).toBeVisible();
  }
  expect(pageErrors, 'Unexpected browser errors in School Manager timetable and calendar').toEqual([]);
});


test('School Manager parent communication oversight is reachable across desktop, tablet and mobile', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Parent Communication', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Parent communication & announcements', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'School announcements', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Parent engagement', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Parent notification delivery', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Parent–student link coverage', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Messaging activity', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'School messaging activity', exact: true })).toBeVisible();
  }
  expect(pageErrors, 'Unexpected browser errors in School Manager parent communications').toEqual([]);
});


test('School Manager staff and student support workflows are reachable across desktop, tablet and mobile', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Staff & Student Support', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Staff task operations', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Assign a staff task', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Task register', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Staff accountability' }).click();
    await expect(page.getByRole('heading', { name: 'Staff accountability', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Record a staff evaluation', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff conduct reports', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff change requests', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Manager escalations' }).click();
    await expect(page.getByRole('heading', { name: 'Manager escalations', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Request a staff responsibility change', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recommend staff disciplinary review', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send request for review', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send recommendation to Super Admin', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Student support' }).click();
    await expect(page.getByRole('heading', { name: 'Student support & safeguarding oversight', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Behavior report monitoring', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Student disciplinary recommendations', exact: true })).toBeVisible();
  }
  expect(pageErrors, 'Unexpected browser errors in School Manager staff and student support').toEqual([]);
});


test('School Manager content governance oversight is reachable across desktop, tablet and mobile', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Content Governance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Content governance', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review queue', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resource catalog', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review history', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Review history', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Content review history', exact: true })).toBeVisible();
  }
  expect(pageErrors, 'Unexpected browser errors in School Manager content governance').toEqual([]);
});


test('School Manager command center, grouped navigation, reports and student search are usable across devices', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText('School setup checklist')).toBeVisible();
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('button', { name: 'Student Directory', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reports & Analytics', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reports & analytics', exact: true })).toBeVisible();
    await expect(page.getByText('Enrollment distribution', { exact: true })).toBeVisible();
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Student Directory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Student directory', exact: true })).toBeVisible();
    const studentSearch = page.getByRole('textbox', { name: 'Search student records' });
    await expect(studentSearch).toBeVisible();
    await studentSearch.fill('ci_student');
    await expect(page.getByText('CI Student', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open profile', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Student profile', exact: true })).toBeVisible();
    await expect(page.getByText('School student ID', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Published term results', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Attendance', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Back to directory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Student directory', exact: true })).toBeVisible();
  }
  expect(pageErrors, 'Unexpected browser errors in School Manager command center and reports').toEqual([]);
});

 
test('School Manager finance accountability and fee budget oversight are reachable across devices', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await authenticateAs(page, 'ci-manager@masterminds.test');
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/school/manager', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Good day\\. Here's what needs your attention/ })).toBeVisible({ timeout: 25_000 });
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Fees & Finance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'School fees & finance', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fee plan and budget oversight', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Finance payment accountability', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Finance activity audit', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search finance audit events' })).toBeVisible();
  }
  expect(pageErrors, 'Unexpected browser errors in School Manager finance accountability').toEqual([]);
});
