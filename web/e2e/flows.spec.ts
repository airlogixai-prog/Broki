// Flows added in the modernization pass: task completion, aircraft registry
// CRUD, optimistic-concurrency conflict and cross-session Realtime. Same stack
// requirements as broki.spec.ts (local Supabase + seed + QA user).

import { expect, test, type Browser, type Page } from "@playwright/test";

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
  await expect(page).toHaveURL(/\/broki/, { timeout: 30_000 });
}

async function secondSession(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  return page;
}

test.describe("planner tasks", () => {
  test("a task can be completed and reopened, and the state survives a reload", async ({ page }) => {
    await login(page);
    await page.goto("/broki/planner");
    const card = page.getByRole("article", { name: /EC-NFP/ });
    await expect(card).toBeVisible({ timeout: 20_000 });

    // Seed task "Revisar luz de posicion ala derecha" (MEL-2201, estado 0). The
    // PDF import test adds another MEL-2201 row, so scope by description.
    const taskBox = (p: Page) =>
      p.getByRole("article", { name: /EC-NFP/ }).getByRole("listitem").filter({ hasText: /Revisar luz de posicion/i }).getByRole("checkbox");
    const box = taskBox(page);
    const wasChecked = await box.isChecked();
    await box.click();
    await expect(box).toBeChecked({ checked: !wasChecked });
    await expect(card.getByText(/Sincronizado/)).toBeVisible({ timeout: 10_000 });

    await page.reload();
    const after = taskBox(page);
    await expect(after).toBeChecked({ checked: !wasChecked, timeout: 20_000 });

    // Restore the seed state.
    await after.click();
    await expect(after).toBeChecked({ checked: wasChecked });
    await page.reload();
    await expect(taskBox(page)).toBeChecked({ checked: wasChecked, timeout: 20_000 });
  });
});

test.describe("aircraft registry", () => {
  test("an aircraft can be created, edited, refused as duplicate and deleted", async ({ page }) => {
    await login(page);
    await page.goto("/broki/aviones");
    await page.getByRole("tab", { name: /registro de flota/i }).click();
    const reg = `EC-Q${Date.now().toString(36).slice(-3).toUpperCase()}`;

    await page.getByRole("button", { name: /nuevo avión/i }).click();
    const modal = page.getByRole("dialog");
    await modal.getByRole("textbox", { name: /matrícula/i }).fill(reg);
    await modal.getByRole("textbox", { name: /aerolínea/i }).fill("QA Air");
    await modal.getByRole("textbox", { name: /modelo/i }).fill("Airbus A320");
    await modal.getByRole("button", { name: /guardar/i }).click();
    await expect(modal).toBeHidden({ timeout: 20_000 });
    const row = page.getByRole("row", { name: new RegExp(reg) });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText("QA Air");

    // Duplicate registration is refused by the server and shown inline.
    await page.getByRole("button", { name: /nuevo avión/i }).click();
    const dup = page.getByRole("dialog");
    await dup.getByRole("textbox", { name: /matrícula/i }).fill(reg);
    await dup.getByRole("button", { name: /guardar/i }).click();
    await expect(dup.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    await dup.getByRole("button", { name: /cancelar/i }).click();

    // Edit.
    await row.getByRole("button", { name: new RegExp(`editar ${reg}`, "i") }).click();
    const edit = page.getByRole("dialog");
    await edit.getByRole("textbox", { name: /msn/i }).fill("12345");
    await edit.getByRole("button", { name: /guardar/i }).click();
    await expect(edit).toBeHidden({ timeout: 20_000 });
    await page.reload();
    await page.getByRole("tab", { name: /registro de flota/i }).click();
    await expect(page.getByRole("row", { name: new RegExp(reg) })).toContainText("12345", { timeout: 20_000 });

    // Delete with confirmation.
    await page.getByRole("row", { name: new RegExp(reg) }).getByRole("button", { name: new RegExp(`eliminar ${reg}`, "i") }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^eliminar$/i }).click();
    await expect(page.getByRole("row", { name: new RegExp(reg) })).toHaveCount(0, { timeout: 20_000 });
  });
});

test.describe("two sessions", () => {
  test("a concurrent edit is refused with a stale-update conflict and can be reloaded", async ({ page, browser }) => {
    test.setTimeout(90_000);
    await login(page);
    const other = await secondSession(browser);

    // Both sessions open the same equipment for editing.
    for (const p of [page, other]) {
      await p.goto("/broki/gse");
      await p.getByRole("button", { name: /GPU-01/ }).first().click();
      await p.getByRole("dialog").getByRole("button", { name: /editar información/i }).click();
    }

    // Session B saves first.
    const noteB = `Nota B ${Date.now()}`;
    await other.getByRole("dialog").getByRole("textbox", { name: /notas/i }).fill(noteB);
    await other.getByRole("dialog").getByRole("button", { name: /guardar cambios/i }).click();
    await expect(other.getByRole("dialog").getByRole("button", { name: /editar información/i })).toBeVisible({ timeout: 20_000 });

    // Session A saves on a stale row → 409, nothing overwritten, reload offered.
    const dialogA = page.getByRole("dialog");
    await dialogA.getByRole("textbox", { name: /notas/i }).fill("Nota A (debe perder)");
    await dialogA.getByRole("button", { name: /guardar cambios/i }).click();
    await expect(dialogA.getByRole("alert")).toContainText(/otro usuario/i, { timeout: 20_000 });
    await dialogA.getByRole("button", { name: /cargar versión actual/i }).click();
    await expect(dialogA.getByRole("textbox", { name: /notas/i })).toHaveValue(noteB);

    // Clean up: clear the note from the winning session.
    await dialogA.getByRole("textbox", { name: /notas/i }).fill("");
    await dialogA.getByRole("button", { name: /guardar cambios/i }).click();
    await expect(dialogA.getByRole("button", { name: /editar información/i })).toBeVisible({ timeout: 20_000 });
    await other.context().close();
  });

  test("a change made in one session appears in another without reloading", async ({ page, browser }) => {
    test.setTimeout(120_000);
    await login(page);
    const other = await secondSession(browser);
    await page.goto("/broki/furgonetas");
    await expect(page.getByRole("status").filter({ hasText: /realtime/i }).first()).toBeVisible({ timeout: 20_000 });

    await other.goto("/broki/furgonetas");
    await other.getByRole("button", { name: /FURGO-01/ }).first().click();
    const dlg = other.getByRole("dialog");
    await dlg.getByRole("button", { name: /editar información/i }).click();
    const worker = `Realtime QA ${Date.now().toString().slice(-4)}`;
    await dlg.getByRole("combobox", { name: /operario/i }).fill(worker);
    await dlg.getByRole("button", { name: /guardar cambios/i }).click();
    await expect(dlg.getByRole("button", { name: /editar información/i })).toBeVisible({ timeout: 20_000 });

    // Session A never reloads. 15 s is well under the 30 s poll, so only Realtime can pass this.
    await expect(page.getByRole("article", { name: /FURGO-01/ }).first()).toContainText(worker, { timeout: 15_000 });

    // Clean up from session B.
    await dlg.getByRole("button", { name: /editar información/i }).click();
    await dlg.getByRole("combobox", { name: /operario/i }).fill("");
    await dlg.getByRole("button", { name: /guardar cambios/i }).click();
    await expect(dlg.getByRole("button", { name: /editar información/i })).toBeVisible({ timeout: 20_000 });
    await other.context().close();
  });
});
