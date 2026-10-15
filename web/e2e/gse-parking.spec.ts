import { test, expect } from "@playwright/test";

const RELEASE = process.env.BROKI_E2E_RELEASE === "1";
const email = process.env.E2E_EMAIL ?? (RELEASE ? "" : "qa@broki.test");
const password = process.env.E2E_PASSWORD ?? (RELEASE ? "" : "brokiqa1234");
if (RELEASE && (!email || !password)) {
  throw new Error("E2E_EMAIL and E2E_PASSWORD required when BROKI_E2E_RELEASE=1");
}

test.describe("GSE parking", () => {
  test("editing parking does not change ubicacion habitual", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL(/\/broki/);

    await page.goto("/broki/gse");
    await expect(page.getByRole("heading", { name: /Equipos GSE/i })).toBeVisible();

    const card = page.getByRole("button", { name: /E-07/i });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Ubicación habitual")).toBeVisible();
    await expect(dialog.getByText("T4")).toBeVisible();
    await expect(dialog.getByText("305", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Editar Información" }).click();
    const parkingInput = dialog.getByLabel("Parking");
    await parkingInput.fill("888");
    await dialog.getByRole("button", { name: "Guardar Cambios" }).click();
    await expect(dialog.getByRole("button", { name: "Editar Información" })).toBeVisible({
      timeout: 10_000,
    });

    await expect(dialog.getByText("888", { exact: true })).toBeVisible();
    await expect(dialog.getByText("T4")).toBeVisible();

    await page.reload();
    await page.goto("/broki/gse");
    await page.getByRole("button", { name: /E-07/i }).click();
    const reloaded = page.getByRole("dialog");
    await expect(reloaded.getByText("888", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(reloaded.getByText("T4")).toBeVisible();

    await reloaded.getByRole("button", { name: "Editar Información" }).click();
    await reloaded.getByLabel("Parking").fill("305");
    await reloaded.getByRole("button", { name: "Guardar Cambios" }).click();
    await expect(reloaded.getByText("305", { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
