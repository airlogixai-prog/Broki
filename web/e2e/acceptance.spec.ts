/**
 * Product acceptance matrix — maps 1:1 to the release checklist.
 * Local: optional skip if auth unavailable (unless BROKI_E2E_RELEASE=1).
 * Release: login failure fails the suite — no skips.
 */
import { expect, test, type Page } from "@playwright/test";

const RELEASE = process.env.BROKI_E2E_RELEASE === "1";
const EMAIL = process.env.E2E_EMAIL ?? (RELEASE ? "" : "qa@broki.test");
const PASSWORD = process.env.E2E_PASSWORD ?? (RELEASE ? "" : "brokiqa1234");

if (RELEASE && (!EMAIL || !PASSWORD)) {
  throw new Error("E2E_EMAIL and E2E_PASSWORD required when BROKI_E2E_RELEASE=1");
}

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/broki/, { timeout: 20_000 });
}

test.describe("acceptance — public (no auth)", () => {
  test("23 public registration form", async ({ page }) => {
    await page.goto("/registrobroki");
    await expect(page.locator("#reg-nombre")).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar registro/i })).toBeVisible();
  });

  test("24 contact form", async ({ page }) => {
    await page.goto("/contacto");
    await expect(page.locator("#lead-name")).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar/i })).toBeVisible();
  });

  test("25 mobile navigation (marketing)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /abrir menú/i }).click();
    await expect(
      page.getByLabel(/navegación móvil/i).getByRole("link", { name: /contacto/i }),
    ).toBeVisible();
  });

  test("26 PWA manifest, service worker and offline page", async ({ page }) => {
    await page.goto("/");
    const manifest = await page.evaluate(async () => {
      const res = await fetch("/manifest.webmanifest");
      return res.ok ? res.json() : null;
    });
    expect(manifest?.start_url).toBe("/");
    expect(manifest?.name).toMatch(/AIRLOGIX/i);
    const sw = await page.evaluate(async () => (await fetch("/sw.js")).status);
    expect(sw).toBe(200);
    const offline = await page.goto("/offline");
    expect(offline?.status()).toBe(200);
  });
});

test.describe("acceptance — dashboard (auth required)", () => {
  let skipDashboard = false;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await login(page);
    } catch (err) {
      if (RELEASE) throw err;
      skipDashboard = true;
    } finally {
      await page.close();
    }
  });

  test.beforeEach(async () => {
    if (skipDashboard) {
      if (RELEASE) throw new Error("dashboard auth required in release E2E");
      test.skip(true, "Supabase auth unavailable");
    }
  });

  test("1 login", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: /furgonetas/i }).first()).toBeVisible();
  });

  test("2 dashboard shell navigates to the 12 destinations", async ({ page }) => {
    await login(page);
    await expect(page.locator(".broki-shell")).toBeVisible();
    const nav = page.getByRole("navigation", { name: /navegación principal/i });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(12);
    for (const [label, path] of [["Tooling", "/broki/tooling"], ["Mapa", "/broki/mapa"], ["Dashboard", "/broki"]] as const) {
      await nav.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(nav.getByRole("link", { name: new RegExp(`^${label}$`, "i") })).toHaveAttribute("aria-current", "page");
    }
  });

  test("3 theme selector persists the theme", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /cuenta y preferencias/i }).click();
    await page.getByRole("menuitemradio", { name: /oceanic/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "oceanic");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "oceanic");
    expect(await page.evaluate(() => localStorage.getItem("broki_theme"))).toBe("oceanic");
    await page.evaluate(() => localStorage.removeItem("broki_theme"));
  });

  test("4 dark mode", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /activar modo oscuro/i }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("5 compact mode", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: /vista compacta/i }).click();
    await expect(page.locator("main.compact-view")).toBeVisible();
  });

  test("6 filters", async ({ page }) => {
    await login(page);
    await page.getByRole("searchbox", { name: /buscar/i }).fill("FURGO");
    const saved = await page.evaluate(() => localStorage.getItem("broki_filters"));
    expect(saved).toContain("FURGO");
  });

  test("7 refresh", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /actualizar datos/i }).click();
    await expect(page.getByRole("button", { name: /actualizar datos/i })).toBeVisible();
  });

  test("8 realtime indicator", async ({ page }) => {
    await login(page);
    await page.goto("/broki/planner");
    await expect(
      page.getByRole("status").filter({ hasText: /realtime|polling|conectando|actualización automática/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("9 furgonetas", async ({ page }) => {
    await login(page);
    await page.goto("/broki/furgonetas");
    await expect(page.getByRole("heading", { level: 1, name: /furgonetas/i })).toBeVisible();
  });

  test("10 GSE", async ({ page }) => {
    await login(page);
    await page.goto("/broki/gse");
    await expect(page.getByRole("heading", { level: 1, name: /equipos gse/i })).toBeVisible();
  });

  test("11 equipment modal", async ({ page }) => {
    await login(page);
    await page.goto("/broki/furgonetas");
    await page.getByText(/FURGO-/i).first().click({ timeout: 20_000 });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("12 save error surfaces", async ({ page }) => {
    await login(page);
    await page.goto("/broki/furgonetas");
    await page.getByText(/FURGO-/i).first().click({ timeout: 20_000 });
    const modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: /editar información/i }).click();
    await page.route("**/functions/v1/equipment-update", (route) =>
      route.fulfill({ status: 500, body: '{"error":"qa forced"}' }),
    );
    await modal.getByRole("button", { name: /guardar cambios/i }).click();
    await expect(modal.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  });

  test("13 incident open", async ({ page }) => {
    await login(page);
    await page.goto("/broki/gse");
    // GPU-01 has no open incident in the seed; E-07 does.
    await page.getByRole("button", { name: /GPU-01/ }).first().click({ timeout: 20_000 });
    const modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: /reportar incidencia/i }).click();
    await expect(modal.getByRole("button", { name: /abrir incidencia/i })).toBeVisible();
  });

  test("14 incidencias page", async ({ page }) => {
    await login(page);
    await page.goto("/broki/incidencias");
    await expect(page.getByRole("heading", { level: 1, name: /incidencias/i })).toBeVisible();
  });

  test("15 map terminals and pins", async ({ page }) => {
    await login(page);
    await page.goto("/broki/mapa");
    await expect(page.getByRole("heading", { level: 1, name: /mapa/i })).toBeVisible();
    // Seed: FURGO-02 (520) and N2-01 (542) are in use and parked in T4S zones.
    await page.getByRole("tab", { name: "T4S" }).click();
    await expect(page.getByRole("application", { name: /plano de terminal 4 satélite/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2, { timeout: 20_000 });
    await expect(page.getByRole("region", { name: /posicionados en T4S/i })).toContainText("FURGO-02");
    await page.getByRole("tab", { name: "T4", exact: true }).click();
    await expect(page.getByRole("application", { name: /plano de terminal 4 con/i })).toBeVisible();
    await expect(page.getByRole("region", { name: /sin posición/i })).toContainText("FURGO-02");
  });

  test("16 analytics agrees with the dashboard KPIs", async ({ page }) => {
    await login(page);
    const kpi = page.getByLabel(/indicadores de flota/i);
    await expect(kpi).toBeVisible({ timeout: 20_000 });
    const total = await kpi.getByRole("button", { name: /total equipos/i }).innerText();
    const totalNum = total.replace(/\D/g, "");
    await page.goto("/broki/analytics");
    await expect(page.getByRole("heading", { level: 1, name: /analítica/i })).toBeVisible();
    await expect(page.getByText(/total equipos/i).first().locator("..")).toContainText(totalNum);
    await expect(page.getByRole("img", { name: /estado de la flota/i })).toBeVisible();
  });

  test("17 planner", async ({ page }) => {
    await login(page);
    await page.goto("/broki/planner");
    await expect(page.getByRole("heading", { level: 1, name: /planificador/i })).toBeVisible();
  });

  test("18 planner PDF zone", async ({ page }) => {
    await login(page);
    await page.goto("/broki/planner");
    await page.getByRole("button", { name: /nueva asignación/i }).click();
    await expect(page.locator('input[type="file"]').first()).toBeAttached();
  });

  test("19 roster", async ({ page }) => {
    await login(page);
    await page.goto("/broki/roster");
    await expect(page.getByRole("heading", { level: 1, name: /horario/i })).toBeVisible();
  });

  test("20 relevos", async ({ page }) => {
    await login(page);
    await page.goto("/broki/fleet");
    await expect(page.getByRole("heading", { level: 1, name: /relevo/i })).toBeVisible();
  });

  test("21 nitrogen", async ({ page }) => {
    await login(page);
    await page.goto("/broki/stock");
    await expect(page.getByRole("heading", { level: 1, name: /nitrógeno/i })).toBeVisible();
  });

  test("22 tooling", async ({ page }) => {
    await login(page);
    await page.goto("/broki/tooling");
    await expect(page.getByRole("heading", { level: 1, name: /tooling/i })).toBeVisible();
  });

  test("25 mobile navigation (dashboard)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole("button", { name: /abrir menú/i }).click();
    await expect(
      page.getByRole("navigation", { name: /navegación principal/i }).getByRole("link", { name: /^mapa$/i }),
    ).toBeVisible();
  });

  test("27 direct reload keeps session", async ({ page }) => {
    await login(page);
    await page.goto("/broki/gse");
    await page.reload();
    await expect(page).toHaveURL(/\/broki\/gse/);
    await expect(page).not.toHaveURL(/login/);
  });

  test("28 logout", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /cuenta/i }).click();
    await page.getByRole("menuitem", { name: /cerrar sesión/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/broki");
    await expect(page).toHaveURL(/\/login/);
  });
});
