import { test, expect } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/contacto",
  "/integraciones",
  "/soluciones",
  "/sobre-nosotros",
  "/solicita-demo",
  "/aviso-legal",
  "/politica-privacidad",
  "/politica-cookies",
  "/gracias",
  "/pres",
  "/registrobroki",
];

test.describe("public AIRLOGIX pages", () => {
  for (const path of PUBLIC_ROUTES) {
    test(`${path} renders with header and footer`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("header")).toBeVisible();
      await expect(page.getByRole("link", { name: /AIRLOGIX/i }).first()).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
    });
  }

  test("contact form blocks submit without required fields", async ({ page }) => {
    await page.goto("/contacto");
    await page.getByRole("button", { name: /enviar/i }).click();
    const name = page.locator("#lead-name");
    await expect(name).toHaveJSProperty("validity.valid", false);
    await expect(page).toHaveURL(/\/contacto$/);
  });

  test("legacy .html redirect to clean route", async ({ page }) => {
    const res = await page.goto("/contacto.html");
    expect(res?.url()).toMatch(/\/contacto$/);
  });
});
