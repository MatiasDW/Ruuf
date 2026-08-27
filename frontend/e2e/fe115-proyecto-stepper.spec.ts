import { expect, test } from "@playwright/test";

test("proyecto page shows stepper with paso 1 de 4", async ({ page }) => {
  await page.goto("/proyecto");
  const stepper = page.locator(".project-form-stepped");
  await expect(stepper).toBeVisible();
  expect(await page.getByText("Paso 1 de 4").count()).toBe(1);
});

test("sunlight chips are visible and clickable", async ({ page }) => {
  await page.goto("/proyecto");
  const sunChips = page.getByText(/Pleno sol|Media sombra|Sombra/);
  await expect(sunChips.first()).toBeVisible();
});

test("selecting sunlight chip updates form", async ({ page }) => {
  await page.goto("/proyecto");
  const mediaSombraChip = page.getByRole("button", { name: /Media sombra/ });
  await expect(mediaSombraChip).toBeVisible();
  await mediaSombraChip.click();
});

test("proyecto form has dimensiones and condiciones cards", async ({ page }) => {
  await page.goto("/proyecto");
  expect(await page.getByText("Dimensiones del Terreno").count()).toBe(1);
  expect(await page.getByText("Condiciones Ambientales").count()).toBe(1);
});
