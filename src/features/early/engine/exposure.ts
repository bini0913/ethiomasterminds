/**
 * Per-user item exposure for anti-repetition and discovery counts.
 * Stored locally (offline-first); mirrors the early_item_exposure table shape so it can sync later.
 */
export type Exposure = { seen: number; correct: number; last: number };
type Store = Record<string, Exposure>;

const key = (userId: string | undefined, area: string) => `mm-early-exposure:${userId ?? "anon"}:${area}`;

export function readExposure(userId: string | undefined, area: string): Store {
  try { return JSON.parse(localStorage.getItem(key(userId, area)) || "{}") as Store; } catch { return {}; }
}

export function recordExposure(userId: string | undefined, area: string, itemId: string, correct: boolean) {
  const store = readExposure(userId, area);
  const prev = store[itemId] ?? { seen: 0, correct: 0, last: 0 };
  store[itemId] = { seen: prev.seen + 1, correct: prev.correct + (correct ? 1 : 0), last: Date.now() };
  try { localStorage.setItem(key(userId, area), JSON.stringify(store)); } catch { /* storage full or blocked */ }
}

/** Sort ids: never-seen first, then least-recently-seen; random tie-break. */
export function freshnessOrder<T extends { id: string }>(items: T[], store: Store): T[] {
  return [...items]
    .map((item) => ({ item, r: Math.random() }))
    .sort((a, b) => {
      const ea = store[a.item.id], eb = store[b.item.id];
      if (!ea && eb) return -1;
      if (ea && !eb) return 1;
      if (ea && eb && ea.last !== eb.last) return ea.last - eb.last;
      return a.r - b.r;
    })
    .map((x) => x.item);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
