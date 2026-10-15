/** Pure helpers for persisted UI preferences — unit-testable without React. */

export type ThemeId =
  | "default"
  | "sunset"
  | "oceanic"
  | "forest"
  | "midnight"
  | "monochrome";

const THEMES: ThemeId[] = [
  "default",
  "sunset",
  "oceanic",
  "forest",
  "midnight",
  "monochrome",
];

export function parseDarkMode(raw: string | null): boolean {
  return raw === "true";
}

export function parseCompactMode(raw: string | null): boolean {
  return raw === "true";
}

export function parseAutoRefresh(raw: string | null): boolean {
  return raw !== "false";
}

export interface SavedFilters {
  filter: string;
  avionFilter: string;
  statusFilter: string;
  familyFilter: string;
}

export function parseSavedFilters(raw: string | null): SavedFilters {
  if (!raw) {
    return { filter: "", avionFilter: "all", statusFilter: "all", familyFilter: "all" };
  }
  try {
    const saved = JSON.parse(raw) as Record<string, string>;
    return {
      filter: saved.search ?? "",
      avionFilter: saved.avion ?? "all",
      statusFilter: saved.status ?? "all",
      familyFilter: saved.family ?? "all",
    };
  } catch {
    return { filter: "", avionFilter: "all", statusFilter: "all", familyFilter: "all" };
  }
}

export function serializeFilters(filters: SavedFilters): string {
  return JSON.stringify({
    search: filters.filter,
    status: filters.statusFilter,
    avion: filters.avionFilter,
    family: filters.familyFilter,
  });
}

export function parseTheme(raw: string | null): ThemeId {
  if (raw && (THEMES as string[]).includes(raw)) return raw as ThemeId;
  return "default";
}

export function applyThemeToDocument(theme: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("broki_theme", theme);
  } catch {
    /* private mode */
  }
}
