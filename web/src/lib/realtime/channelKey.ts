/** Stable channel id from table list — sorted, deduped. */
export function realtimeChannelKey(tables: readonly string[]): string {
  return [...new Set(tables)].sort().join("|");
}
