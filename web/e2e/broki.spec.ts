// End-to-end walk through the migrated dashboard. Requires a running stack:
//
//   supabase start && supabase db reset && supabase functions serve
//   E2E_EMAIL=... E2E_PASSWORD=... npx playwright test
//
// The user in E2E_EMAIL must exist in that stack, and the seed in
// supabase/seed.sql must be loaded, since the assertions expect its fixtures.

import { expect, test, type Page } from "@playwright/test";
import { plannerPdf, rosterPdf } from "./fixtures/pdf.ts";

const EMAIL = process.env.E2E_EMAIL ?? "qa@broki.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "brokiqa1234";

const ROUTES = [
  ["/broki", "Furgonetas"],
  ["/broki/furgonetas", "Furgonetas"],
  ["/broki/gse", "Equipos GSE"],
  ["/broki/aviones", "Por Avión"],
  ["/broki/incidencias", "Incidencias"],
  ["/broki/mapa", "Mapa de Equipos"],
  ["/broki/analytics", "Analytics"],
  ["/broki/planner", "Planificador"],
  ["/broki/roster", "Horario"],
  ["/broki/fleet", "Notas de Relevo"],
  ["/broki/stock", "Stock de Nitrógeno"],
  ["/broki/tooling", "Gestión de Tooling"],
] as const;

async function fillPlannerMinimum(form: ReturnType<Page["locator"]>) {
  await form.getByPlaceholder("EC-XXX").fill("EC-NFP");
  await form.locator('input[type="time"]').first().fill("10:00");
  await form.getByPlaceholder("Nombre responsable").fill("QA Responsable");
  const furgo = form.locator("select").first();
  if (await furgo.count()) await furgo.selectOption({ index: 1 });
  else await form.locator("input").filter({ hasText: /^$/ }).nth(3).fill("FURGO-01");
}

async function fillRegistration(page: Page, unique: string) {
  await page.locator("#reg-nombre").fill("QA Persona Playwright");
  await page.locator("#reg-telefono").fill(`6${unique}`);
  await page.locator("#reg-email").fill(`qa${unique}@example.com`);
  await page.getByRole("radio", { name: /mantenimiento/i }).check();
  await page.getByRole("checkbox", { name: /^B1\b/i }).check();
  await page.locator("#reg-bac").fill(`BAC-${unique.slice(0, 4)}`);
  await page.getByRole("checkbox", { name: /política de privacidad/i }).check();
}

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/broki/, { timeout: 30_000 });
}

/** Records every request that leaves the page, so a lingering n8n call shows up. */
function trackRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  return urls;
}

test.describe("auth", () => {
  test("an anonymous visitor is sent to the login page", async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/broki/furgonetas");
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fbroki%2Ffurgonetas/);
    await page.close();
  });
});

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("every route renders and none of them calls n8n", async ({ page }) => {
    const requests = trackRequests(page);

    for (const [path, heading] of ROUTES) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: new RegExp(heading, "i") }).first(),
        `heading of ${path}`,
      ).toBeVisible({ timeout: 20_000 });
    }

    expect(
      requests.filter((u) => /n8n/i.test(u)),
      "the dashboard must not talk to n8n",
    ).toEqual([]);
  });

  test("an equipment record can be edited and the change sticks", async ({ page }) => {
    await page.goto("/broki/furgonetas");

    await page.getByText(/FURGO-/i).first().click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: /editar información/i }).click();

    const parking = modal.locator("input").first();
    const value = `T4S-${Date.now().toString().slice(-4)}`;
    await parking.fill(value);
    await modal.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(modal.getByRole("button", { name: /editar información/i })).toBeVisible();

    // Reload rather than trust the optimistic update: this asserts the write
    // reached Postgres, which is the whole point of the migration.
    await page.reload();
    await page.getByText(/FURGO-/i).first().click();
    await expect(page.getByRole("dialog")).toContainText(value);
  });

  test("an incident can be opened from the equipment modal", async ({ page }) => {
    await page.goto("/broki/gse");
    await page.getByText(/-\d/).first().click();

    const modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: /reportar incidencia/i }).click();

    const defect = `Fuga hidraulica QA ${Date.now()}`;
    await modal.getByRole("textbox").last().fill(defect);
    await modal.getByRole("button", { name: /abrir incidencia/i }).click();

    await page.goto("/broki/incidencias");
    await expect(page.getByText(defect)).toBeVisible({ timeout: 20_000 });
  });

  test("a planner assignment can be created and deleted", async ({ page }) => {
    await page.goto("/broki/planner");
    await page.getByRole("button", { name: /nueva asignación|crear asignación/i }).first().click();

    const form = page.locator("form").first();
    await form.getByPlaceholder("EC-XXX").fill("EC-QAE");
    await form.locator('input[type="time"]').first().fill("12:00");
    await form.getByPlaceholder("Nombre responsable").fill("QA Test");
    await form.locator("select").first().selectOption({ index: 1 });
    await form.getByRole("button", { name: /crear asignación/i }).click();

    await expect(page.getByText("EC-QAE")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByText("EC-QAE")).toBeVisible();

    await page.getByTitle(/eliminar asignación/i).first().click();
    page.once("dialog", (d) => d.accept());
  });

  test("a planner work sheet PDF is imported into tasks", async ({ page }) => {
    await page.goto("/broki/planner");
    await page.getByRole("button", { name: /nueva asignación|crear asignación/i }).first().click();

    const form = page.locator("form").first();
    await fillPlannerMinimum(form);
    await form.locator('input[type="file"]').setInputFiles({
      name: "hoja-trabajo.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(plannerPdf()),
    });
    await form.getByRole("button", { name: /crear asignación/i }).click();

    // The fixture carries two tasks on EC-NFP.
    await expect(page.getByText(/MEL-2201/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Revision tren principal derecho/i)).toBeVisible();
  });

  test("a roster PDF is imported and shown for the week", async ({ page }) => {
    await page.goto("/broki/roster");

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "horario.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(rosterPdf()),
    });

    await expect(page.getByText(/MARIO LORENZO/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("07:00-19:00").first()).toBeVisible();

    // Roster data used to be a hardcoded array in the page; a reload proves it
    // now comes from the database.
    await page.reload();
    await expect(page.getByText(/MARIO LORENZO/i)).toBeVisible({ timeout: 20_000 });
  });

  test("a relay note survives a reload and a new browser context", async ({ page, browser }) => {
    await page.goto("/broki/fleet");
    await page.getByRole("button", { name: /nuevo relevo|crear primer relevo/i }).first().click();

    const modal = page.getByRole("dialog");
    const plane = `EC-QA${Date.now().toString().slice(-3)}`;
    const boxes = modal.getByRole("textbox");
    await boxes.first().fill(plane);
    await boxes.last().fill("Punto de relevo QA");
    await modal.getByRole("button", { name: /guardar relevo/i }).click();

    await expect(page.getByText(plane)).toBeVisible({ timeout: 20_000 });

    // A different context has a different localStorage, which is where relays
    // used to live. Seeing the note here means it is really in Postgres.
    const other = await browser.newPage();
    await login(other);
    await other.goto("/broki/fleet");
    await expect(other.getByText(plane)).toBeVisible({ timeout: 20_000 });
    await other.close();
  });

  test("nitrogen stock can be edited", async ({ page }) => {
    await page.goto("/broki/stock");
    await page.getByRole("button", { name: /editar stock/i }).click();

    const input = page.locator('input[type="number"]').first();
    const value = String(5 + (Date.now() % 20));
    await input.fill(value);
    await page.getByRole("button", { name: /confirmar/i }).first().click();

    await page.reload();
    await expect(page.getByText(value).first()).toBeVisible({ timeout: 20_000 });
  });

  test("a tool can be checked out and back in", async ({ page }) => {
    await page.goto("/broki/tooling");
    await page.getByRole("button", { name: /sacar herramienta/i }).click();

    const modal = page.getByRole("dialog");
    const boxes = modal.getByRole("textbox");
    await boxes.first().fill("BAC-QA-01");
    await boxes.nth(1).fill("TMA-QA-01");
    await modal.getByRole("button", { name: /confirmar sacada/i }).click();

    await expect(page.getByText("BAC-QA-01")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /devolver/i }).first().click();
    await page.getByRole("button", { name: /confirmar devolución/i }).click();
  });
});

test.describe("public registration", () => {
  test("a registration is accepted once and refused as a duplicate", async ({ page }) => {
    const unique = Date.now().toString().slice(-8);

    const submit = async () => {
      await page.goto("/registrobroki");
      await fillRegistration(page, unique);
      await page.getByRole("button", { name: /enviar registro/i }).click();
    };

    await submit();
    await expect(page.getByText(/registro recibido/i)).toBeVisible({
      timeout: 30_000,
    });

    await submit();
    await expect(page.getByText(/ya (est|existe)|duplicad|registrad/i)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("the form refuses an obviously invalid phone number", async ({ page }) => {
    await page.goto("/registrobroki");
    await page.locator("#reg-nombre").fill("QA Invalido");
    await page.locator("#reg-telefono").fill("123");
    await page.getByRole("radio", { name: /mantenimiento/i }).check();
    await page.getByRole("checkbox", { name: /^B1\b/i }).check();
    await page.getByRole("checkbox", { name: /política de privacidad/i }).check();
    await page.getByRole("button", { name: /enviar registro/i }).click();

    await expect(page.getByText(/tel[eé]fono/i).first()).toBeVisible();
  });
});
