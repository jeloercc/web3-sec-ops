/**
 * Extract a numeric gas‑percentage from the anomaly metadata.
 *
 * The metadata may contain any of the following keys:
 *   - gasUsedPercent        (the new canonical key)
 *   - gasUsageRatio         (old key – stored as a 0‑1 float)
 *   - gasPercent            (another historic alias)
 *   - gasUsedPercentage    (rare alias)
 *
 * Returns a **percentage** (0‑100) as a `number`, or `null` if it cannot be parsed.
 */
export function extractGas(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;

  const obj = metadata as Record<string, unknown>;

  // Grab the first defined key, falling back through the historic aliases
  const raw = obj.gasUsedPercent ?? obj.gasUsageRatio ?? obj.gasPercent ?? obj.gasUsedPercentage;

  // Must be a finite number – reject NaN, Infinity, non‑numeric strings, etc.
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;

  // Some older records stored the ratio as a **fraction** (e.g. 0.75);
  // convert it to a percentage if it is <= 1.
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}