import { expect, test } from "@playwright/test";

const publicRoutes = [
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/terms", heading: "Terms of Use" },
  { path: "/delete-account", heading: "Request account deletion" },
  { path: "/child-safety", heading: "Child Safety Standards" },
  { path: "/guardian-consent", heading: "Parent or guardian approval" },
];

for (const route of publicRoutes) {
  test(`${route.path} renders without a route crash`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/This page couldn't load|unexpected rendering error/i);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(horizontalOverflow, `${route.path} should fit the current viewport`).toBe(false);
    expect(pageErrors, `${route.path} should not throw uncaught browser errors`).toEqual([]);
  });
}

test("the public landing route renders meaningful content", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.locator("body")).not.toContainText(/This page couldn't load|unexpected rendering error/i);
  await expect.poll(async () => (await page.locator("body").innerText()).trim().length).toBeGreaterThan(20);
  expect(pageErrors).toEqual([]);
});
