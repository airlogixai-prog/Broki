#!/usr/bin/env node
/**
 * Visual QA: logs into the dashboard and captures every route at several
 * viewports in light and dark mode. Reports horizontal overflow and console
 * errors per capture. Needs a running Next dev/start and a reachable Supabase.
 *
 *   E2E_BASE_URL=http://127.0.0.1:3100 E2E_EMAIL=qa@broki.test E2E_PASSWORD=... \
 *   node web/scripts/qa-screenshots.mjs [outDir]
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const EMAIL = process.env.E2E_EMAIL ?? "qa@broki.test";
const PASSWORD = process.env.E2E_PASSWORD ?? "brokiqa1234";
const OUT = process.argv[2] ?? "qa-screenshots";
const ROUTES = ["/broki", "/broki/furgonetas", "/broki/gse", "/broki/aviones", "/broki/incidencias", "/broki/mapa", "/broki/analytics", "/broki/planner", "/broki/roster", "/broki/fleet", "/broki/stock", "/broki/tooling", "/registrobroki"];
const VIEWPORTS = (process.env.QA_VIEWPORTS ?? "360x780,390x844,768x1024,1024x768,1440x900").split(",").map((v) => v.split("x").map(Number));
const THEMES = (process.env.QA_THEMES ?? "light,dark").split(",");

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const report = [];

for (const theme of THEMES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await page.waitForURL(/\/broki/, { timeout: 30_000 });
  await page.evaluate((dark) => {
    localStorage.setItem("broki_dark_mode", dark ? "true" : "false");
  }, theme === "dark");

  for (const [w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    for (const route of ROUTES) {
      const errors = [];
      const onConsole = (m) => m.type() === "error" && errors.push(m.text());
      const onPageError = (e) => errors.push(String(e));
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        title: document.querySelector("h1")?.textContent?.trim() ?? "",
      }));
      const name = `${theme}_${w}x${h}_${route.replace(/\//g, "_").replace(/^_/, "") || "home"}.png`;
      await page.screenshot({ path: join(OUT, name), fullPage: true });
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      const ignorable = (e) => /favicon|Download the React DevTools|hydrat|404 \(Not Found\).*manifest/i.test(e);
      report.push({ theme, viewport: `${w}x${h}`, route, title: overflow.title, hOverflow: overflow.scrollWidth > overflow.clientWidth + 1, errors: errors.filter((e) => !ignorable(e)) });
    }
  }
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.hOverflow || r.errors.length);
console.log(`${report.length} capturas en ${OUT}`);
for (const r of bad) console.log(`! ${r.theme} ${r.viewport} ${r.route}: ${r.hOverflow ? "overflow-x " : ""}${r.errors.slice(0, 2).join(" | ")}`);
if (bad.length === 0) console.log("Sin overflow horizontal ni errores de consola.");
