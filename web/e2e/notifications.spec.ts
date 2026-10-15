import { expect, test } from "@playwright/test";

const RELEASE = process.env.BROKI_E2E_RELEASE === "1";
const EMAIL = process.env.E2E_EMAIL ?? (RELEASE ? "" : "qa@broki.test");
const PASSWORD = process.env.E2E_PASSWORD ?? (RELEASE ? "" : "brokiqa1234");
if (RELEASE && (!EMAIL || !PASSWORD)) {
  throw new Error("E2E_EMAIL and E2E_PASSWORD required when BROKI_E2E_RELEASE=1");
}

test.describe("notifications", () => {
  test("bell is visible after login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/broki/, { timeout: 30_000 });

    const bell = page.locator("[data-notifications-root]");
    await expect(bell).toBeVisible({ timeout: 20_000 });
    // Seed: FURGO-02 fuel 18 % (< 25) and E-07 open incident → at least 2 alerts.
    await expect(bell.getByRole("button").first()).toHaveAttribute("aria-label", /alertas: \d+ activas/i, { timeout: 20_000 });
    await bell.getByRole("button").first().click();
    const panel = page.getByRole("dialog", { name: /alertas operativas/i });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("listitem")).toHaveCount(await panel.getByRole("listitem").count());
    await expect(panel).toContainText(/Combustible crítico: FURGO-02/);
    await expect(panel).toContainText(/Incidencia abierta: E-07/);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });
});
