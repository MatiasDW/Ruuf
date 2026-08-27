import { expect, test } from "@playwright/test";

test("plants page loads and shows stepper", async ({ page }) => {
  await page.goto("/plantas");
  await expect(page.locator("body")).toBeVisible();
  expect(await page.getByText("Elige plantas para tu jardín").count()).toBeGreaterThan(0);
});

test("category chips exist on page", async ({ page }) => {
  await page.goto("/plantas");
  const chips = page.locator(".chip");
  expect(await chips.count()).toBeGreaterThan(0);
});

test("style cards are visible", async ({ page }) => {
  await page.goto("/plantas");
  const styles = page.locator(".style-card");
  expect(await styles.count()).toBeGreaterThan(0);
});

test("styles grid loads", async ({ page }) => {
  await page.goto("/plantas");
  const grid = page.locator(".styles-grid");
  await expect(grid).toBeVisible();
});
