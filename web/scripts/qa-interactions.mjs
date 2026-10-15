#!/usr/bin/env node
/**
 * Visual QA of interactive states: equipment modal (read + edit), planner
 * creator, tooling checkout, relay modal, alerts bell, mobile menu.
 *
 *   E2E_BASE_URL=http://127.0.0.1:3100 node web/scripts/qa-interactions.mjs [outDir]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const EMAIL = process.env.E2E_EMAIL ?? "qa@broki.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "brokiqa1234";
const OUT = process.argv[2] ?? "qa-interactions";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "mobile"]]) {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/login`);
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await page.waitForURL(/\/broki/, { timeout: 60_000 });
    await page.evaluate((d) => localStorage.setItem("broki_dark_mode", d ? "true" : "false"), theme === "dark");
    await page.reload({ waitUntil: "networkidle" });
    const shot = (name) => page.screenshot({ path: join(OUT, `${theme}_${tag}_${name}.png`), fullPage: false });

    await page.getByRole("button", { name: /FURGO-02/ }).first().click();
    await page.getByRole("dialog").waitFor();
    await shot("modal-furgo-read");
    await page.getByRole("button", { name: /editar información/i }).click();
    await page.waitForTimeout(300);
    await shot("modal-furgo-edit");
    await page.keyboard.press("Escape");

    await page.goto(`${BASE}/broki/gse`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /N2-01/ }).first().click();
    await page.getByRole("dialog").waitFor();
    await shot("modal-n2-read");
    await page.keyboard.press("Escape");

    await page.goto(`${BASE}/broki/gse`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /E-07/ }).first().click();
    await page.getByRole("dialog").waitFor();
    await shot("modal-incident-open");
    await page.keyboard.press("Escape");

    await page.goto(`${BASE}/broki`, { waitUntil: "networkidle" });
    await page.locator("[data-notifications-root] button").first().click();
    await page.waitForTimeout(300);
    await shot("alerts-bell");
    await page.keyboard.press("Escape");

    if (tag === "mobile") {
      await page.getByRole("button", { name: /abrir menú/i }).click();
      await page.waitForTimeout(300);
      await shot("mobile-menu");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /cerrar menú/i }).click().catch(() => {});
    }

    await page.goto(`${BASE}/broki/planner`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /nueva asignación/i }).first().click();
    await page.getByRole("dialog").waitFor();
    await shot("planner-creator");
    await page.keyboard.press("Escape");

    await page.goto(`${BASE}/broki/tooling`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /sacar herramienta/i }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByLabel(/código bac/i).selectOption("BACT-2001").catch(() => {});
    await shot("tooling-checkout");
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: /catálogo/i }).click();
    await page.waitForTimeout(300);
    await shot("tooling-catalog");

    await page.goto(`${BASE}/broki/fleet`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /nuevo relevo/i }).first().click();
    await page.getByRole("dialog").waitFor();
    await shot("relay-modal");
    await page.keyboard.press("Escape");

    await page.goto(`${BASE}/broki/stock`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /editar stock/i }).click();
    await page.waitForTimeout(300);
    await shot("stock-edit");

    await page.goto(`${BASE}/broki/roster`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /^día$/i }).click();
    await page.waitForTimeout(300);
    await shot("roster-daily");

    await page.close();
  }
}
await browser.close();
console.log(`capturas de interacción en ${OUT}`);
