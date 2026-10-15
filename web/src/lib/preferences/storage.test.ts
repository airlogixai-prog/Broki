import assert from "node:assert/strict";
import {
  applyThemeToDocument,
  parseAutoRefresh,
  parseCompactMode,
  parseDarkMode,
  parseSavedFilters,
  parseTheme,
  serializeFilters,
} from "./storage.ts";

assert.equal(parseDarkMode("true"), true);
assert.equal(parseDarkMode("false"), false);
assert.equal(parseCompactMode("true"), true);
assert.equal(parseAutoRefresh(null), true);
assert.equal(parseAutoRefresh("false"), false);

assert.deepEqual(parseSavedFilters(null), {
  filter: "",
  avionFilter: "all",
  statusFilter: "all",
  familyFilter: "all",
});
assert.deepEqual(
  parseSavedFilters(JSON.stringify({ search: "FURGO", status: "open" })),
  { filter: "FURGO", avionFilter: "all", statusFilter: "open", familyFilter: "all" },
);
assert.equal(
  serializeFilters({
    filter: "x",
    avionFilter: "EC-",
    statusFilter: "busy",
    familyFilter: "gpu",
  }),
  '{"search":"x","status":"busy","avion":"EC-","family":"gpu"}',
);

assert.equal(parseTheme("oceanic"), "oceanic");
assert.equal(parseTheme("invalid"), "default");

if (typeof document !== "undefined") {
  applyThemeToDocument("forest");
  assert.equal(document.documentElement.getAttribute("data-theme"), "forest");
}

console.log("preferences storage ok");
