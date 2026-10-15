"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the hydration render, true afterwards. Use it for UI that
 * depends on localStorage preferences so the first client render matches the
 * server HTML (otherwise React reports a hydration mismatch).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
