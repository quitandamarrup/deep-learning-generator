/**
 * Pure, dependency-free fingerprinting for Capaian Pembelajaran (CP) text.
 *
 * Lives in its own file (rather than in master-kurikulum.ts, where it
 * originated) so that cp-analysis.functions.ts can use it too — e.g. to build
 * an AI-response cache key — without creating a circular import: master-
 * kurikulum.ts already imports types from cp-analysis.functions.ts, so the
 * reverse import would otherwise form a cycle between the two.
 */
export function cpFingerprint(cp: string): string {
  const s = cp.replace(/\s+/g, " ").trim().toLowerCase();
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
  }
  return `${s.length.toString(36)}-${h1.toString(36)}`;
}
