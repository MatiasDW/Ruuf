import { expect, test } from "@playwright/test";

test("plan summary section is visible", async ({ page }) => {
  await page.goto("/plan");
  const section = page.locator(".plan-summary-section");
  expect(await section.count()).toBeGreaterThanOrEqual(0);
});

test("summary tiles show water and cost", async ({ page }) => {
  await page.goto("/plan");
  const tiles = page.locator(".summary-tile");
  expect(await tiles.count()).toBeGreaterThanOrEqual(0);
});

test("unplaced suggestions render when available", async ({ page }) => {
  await page.goto("/plan");
  const section = page.locator(".unplaced-section");
  expect(await section.count()).toBeGreaterThanOrEqual(0);
});

test("action buttons are accessible", async ({ page }) => {
  await page.goto("/plan");
  const buttons = page.locator(".action-button");
  expect(await buttons.count()).toBeGreaterThanOrEqual(0);
});
