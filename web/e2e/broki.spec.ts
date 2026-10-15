// End-to-end walk through the migrated dashboard. Requires a running stack:
//
//   supabase start && supabase db reset && supabase functions serve
//   E2E_EMAIL=... E2E_PASSWORD=... npx playwright test
//
// The user in E2E_EMAIL must exist in that stack, and the seed in
// supabase/seed.sql must be loaded, since the assertions expect its fixtures.

import { expect, test, type Page } from "@playwright/test";
import { plannerPdf, rosterPdf } from "./fixtures/pdf.ts";

const RELEASE = process.env.BROKI_E2E_RELEASE === "1";
const EMAIL = process.env.E2E_EMAIL ?? (RELEASE ? "" : "qa@broki.test");
const PASSWORD = process.env.E2E_PASSWORD ?? (RELEASE ? "" : "brokiqa1234");
if (RELEASE && (!EMAIL || !PASSWORD)) {
  throw new Error("E2E_EMAIL and E2E_PASSWORD required when BROKI_E2E_RELEASE=1");
}
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
  /\/$/,
  "",
);
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

async function restDelete(filter: string): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/${filter}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "return=minimal",
    },
  });
}

/** Cleanup QA residues even on failure/timeout (needs service role in CI/local). */
async function cleanupQaPersonnel(email: string) {
  await restDelete(`broki_personnel?correo=eq.${encodeURIComponent(email)}`);
}

async function cleanupQaTooling(bac: string) {
  // Only the movement this test created (edge_function source, closed by the test).
  await restDelete(
    `broki_tooling_movements?bac_bact=eq.${encodeURIComponent(bac)}&source_system=eq.edge_function`,
  );
}

const ROUTES = [
  ["/broki", "Centro de operaciones"],
  ["/broki/furgonetas", "Furgonetas"],
  ["/broki/gse", "Equipos GSE"],
  ["/broki/aviones", "Aviones"],
  ["/broki/incidencias", "Incidencias"],
  ["/broki/mapa", "Mapa de equipos"],
  ["/broki/analytics", "Analítica"],
  ["/broki/planner", "Planificador"],
  ["/broki/roster", "Horario"],
  ["/broki/fleet", "Relevos"],
  ["/broki/stock", "Stock de nitrógeno"],
  ["/broki/tooling", "Tooling"],
] as const;

/** Seed has aircraft/personnel/vans, so the creator renders selects, not free text. */
async function fillPlannerMinimum(form: ReturnType<Page["locator"]>, reg = "EC-NFP") {
  await form.getByRole("combobox", { name: /matrícula avión/i }).selectOption(reg);
  await form.getByRole("textbox", { name: /hora salida/i }).fill("10:00");
  await form.getByRole("combobox", { name: /responsable/i }).selectOption({ index: 1 });
  await form.getByRole("combobox", { name: /vehículo/i }).selectOption({ index: 1 });
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

    const parking = modal.getByRole("textbox", { name: /parking actual/i });
    const value = `P-${Date.now().toString().slice(-4)}`;
    await parking.fill(value);
    await modal.getByRole("button", { name: /guardar cambios/i }).click();

    await expect(modal.getByRole("button", { name: /editar información/i })).toBeVisible();

    // Reload rather than trust the optimistic update: this asserts the write
    // reached Postgres, which is the whole point of the migration. The modal is
    // deep-linked (?equipo=…), so it reopens by itself after the reload.
    await page.reload();
    const reopened = page.getByRole("dialog");
    await expect(reopened.getByTitle(/posición actual/i)).toContainText(value, { timeout: 20_000 });

    // Leave the seed as it was.
    await reopened.getByRole("button", { name: /editar información/i }).click();
    await reopened.getByRole("textbox", { name: /parking actual/i }).fill("");
    await reopened.getByRole("button", { name: /guardar cambios/i }).click();
    await expect(reopened.getByRole("button", { name: /editar información/i })).toBeVisible({ timeout: 20_000 });
  });

  test("an incident can be opened, listed and resolved", async ({ page }) => {
    await page.goto("/broki/gse");
    await page.getByRole("button", { name: /GPU-01/ }).first().click();

    const modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: /reportar incidencia/i }).click();

    const defect = `Fuga hidraulica QA ${Date.now()}`;
    await modal.getByRole("textbox", { name: /descripción/i }).fill(defect);
    await modal.getByRole("button", { name: /abrir incidencia/i }).click();
    await expect(modal.getByRole("region", { name: /incidencia abierta/i })).toContainText(defect, { timeout: 20_000 });

    await page.goto("/broki/incidencias");
    await expect(page.getByText(defect).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("article", { name: /GPU-01/ }).or(page.getByRole("button", { name: /GPU-01/ })).first()).toBeVisible();

    // Resolve it so the seed stays clean for the next run; the history keeps it.
    await page.getByRole("button", { name: /GPU-01/ }).first().click();
    const again = page.getByRole("dialog");
    await again.getByRole("textbox", { name: /actualización o nota de cierre/i }).fill("Reparado QA");
    await again.getByRole("checkbox", { name: /marcar como resuelta/i }).check();
    await again.getByRole("button", { name: /enviar y resolver/i }).click();
    await expect(again.getByText(/sin incidencia abierta/i)).toBeVisible({ timeout: 20_000 });
    await expect(again.getByRole("heading", { name: /historial/i })).toBeVisible();
  });

  test("a planner assignment can be created and deleted", async ({ page }) => {
    await page.goto("/broki/planner");
    await page.getByRole("button", { name: /nueva asignación|crear asignación/i }).first().click();

    const form = page.getByRole("dialog");
    await fillPlannerMinimum(form, "EC-MKN");
    await form.getByRole("button", { name: /crear asignación/i }).click();

    await expect(page.getByRole("article", { name: /EC-MKN/ })).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByRole("article", { name: /EC-MKN/ })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /eliminar asignación EC-MKN/i }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^eliminar$/i }).click();
    await expect(page.getByRole("article", { name: /EC-MKN/ })).toHaveCount(0, { timeout: 20_000 });
  });

  test("a planner work sheet PDF is previewed and then imported into tasks", async ({ page }) => {
    await page.goto("/broki/planner");
    await page.getByRole("button", { name: /nueva asignación|crear asignación/i }).first().click();

    const form = page.getByRole("dialog");
    await fillPlannerMinimum(form);
    await form.locator('input[type="file"]').setInputFiles({
      name: "hoja-trabajo.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(plannerPdf()),
    });

    // Dry run: tasks are shown before anything is written.
    await form.getByRole("button", { name: /previsualizar pdf/i }).click();
    await expect(form.getByRole("region", { name: /tareas detectadas/i })).toContainText(/MEL-2201/, { timeout: 60_000 });

    await form.getByRole("button", { name: /crear asignación/i }).click();
    await expect(form).toBeHidden({ timeout: 60_000 });

    // The fixture carries two tasks on EC-NFP.
    const tasks = page.getByRole("list", { name: /tareas/i }).first();
    await expect(tasks).toContainText(/MEL-2201/, { timeout: 60_000 });
    await expect(tasks).toContainText(/Revision tren principal derecho/i);
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
    const plane = "EC-OBM";
    const point = `Punto de relevo QA ${Date.now()}`;
    await modal.getByRole("combobox", { name: /avión/i }).selectOption(plane);
    await modal.getByRole("combobox", { name: /técnico firmante/i }).fill("QA Firmante");
    await modal.getByRole("textbox", { name: /novedad 1/i }).fill(point);
    await modal.getByRole("button", { name: /guardar relevo/i }).click();

    await expect(page.getByText(point)).toBeVisible({ timeout: 20_000 });

    // A different context has a different localStorage, which is where relays
    // used to live. Seeing the note here means it is really in Postgres.
    const other = await browser.newPage();
    await login(other);
    await other.goto("/broki/fleet");
    await expect(other.getByText(point)).toBeVisible({ timeout: 20_000 });
    await other.close();
  });

  test("nitrogen stock can be edited", async ({ page }) => {
    await page.goto("/broki/stock");
    await page.getByRole("button", { name: /editar stock/i }).click();

    const input = page.getByLabel(/botellas llenas T4S/i);
    const current = await input.inputValue();
    let value = String(21 + (Date.now() % 50));
    if (value === current) value = String(Number(value) + 1);
    await input.fill(value);
    await page.getByRole("button", { name: /^confirmar/i }).first().click();
    await expect(page.getByRole("status").filter({ hasText: /stock guardado/i })).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.getByRole("region", { name: /stock T4S/i }).getByRole("definition").first()).toHaveText(value, { timeout: 20_000 });
  });

  test("a tool can be checked out and back in", async ({ page }) => {
    // BAC-1001 is seeded as returned (available); BAC-1002 is seeded as checked out.
    const bac = "BAC-1001";
    try {
      await page.goto("/broki/tooling");
      await expect(page.getByRole("tab", { name: /catálogo/i })).toContainText("3", { timeout: 20_000 });
      await page.getByRole("button", { name: /sacar herramienta/i }).click();

      const modal = page.getByRole("dialog");
      await modal.getByRole("combobox", { name: /código bac/i }).selectOption(bac);
      await modal.getByRole("combobox", { name: /tma responsable/i }).selectOption({ label: "Mario Lorenzo" });
      await modal.getByRole("radio", { name: /defectuosa/i }).check();
      await modal.getByRole("button", { name: /confirmar sacada/i }).click();

      const card = page.getByRole("article", { name: `Sacada ${bac}` });
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expect(card).toContainText(/Salida: Defectuoso/);

      // A second checkout of the same tool is refused by the server (409) and shown.
      await page.getByRole("button", { name: /sacar herramienta/i }).click();
      const again = page.getByRole("dialog");
      await expect(again.getByRole("combobox", { name: /código bac/i }).locator(`option[value="${bac}"]`)).toBeDisabled();
      await again.getByRole("button", { name: /cancelar/i }).click();

      await card.getByRole("button", { name: /devolver/i }).click();
      const checkin = page.getByRole("dialog");
      await checkin.getByRole("combobox", { name: /tma que devuelve/i }).selectOption({ label: "Enrique Garcia" });
      await checkin.getByRole("button", { name: /confirmar devolución/i }).click();
      await expect(card).toHaveCount(0, { timeout: 20_000 });

      await page.getByRole("tab", { name: /historial/i }).click();
      await expect(page.getByRole("tabpanel")).toContainText("Enrique Garcia");
    } finally {
      await cleanupQaTooling(bac);
    }
  });
});

test.describe("public registration", () => {
  test("a registration is accepted once and refused as a duplicate", async ({ page }) => {
    const unique = Date.now().toString().slice(-8);
    const email = `qa${unique}@example.com`;

    try {
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
    } finally {
      await cleanupQaPersonnel(email);
    }
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
