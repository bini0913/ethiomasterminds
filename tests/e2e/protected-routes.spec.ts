import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/quiz",
  "/multiplayer",
  "/lobby",
  "/leaderboard",
  "/profile",
  "/settings",
  "/notifications",
  "/teacher",
  "/admin",
  "/admin/early-content",
  "/student-dashboard",
  "/school/manager",
  "/school/admin",
  "/school/teacher",
  "/school/parent",
  "/school/finance",
  "/school/student",
  "/school/super-admin",
  "/store",
  "/tournaments",
  "/ai-tutor",
  "/learning-dna",
  "/study-mode",
  "/library",
  "/parent-dashboard",
  "/revision",
  "/avatar-creator",
  "/finance",
  "/super-admin",
  "/root-control-portal-9xA7",
  "/migrate-supabase",
];

for (const route of protectedRoutes) {
  test(`anonymous access to ${route} is guarded without crashing`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("body")).not.toContainText(/This page couldn't load|unexpected rendering error/i);
    await expect.poll(async () => (await page.locator("body").innerText()).trim().length).toBeGreaterThan(20);
    expect(pageErrors, `${route} should not throw uncaught browser errors`).toEqual([]);
  });
}
