import type { KeyboardEvent } from "react";

/**
 * WAI-ARIA tablist keyboard support for our button-based tabs: Left/Right
 * (and Up/Down) move focus and activate the neighbouring tab, Home/End jump.
 * Attach to the element carrying role="tablist".
 */
export function onTabListKeyDown(e: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'));
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (tabs.length === 0 || current < 0) return;
  e.preventDefault();
  let next = current;
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (current - 1 + tabs.length) % tabs.length;
  else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (current + 1) % tabs.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = tabs.length - 1;
  tabs[next].focus();
  tabs[next].click();
}
