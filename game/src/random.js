// A small seeded random number generator (mulberry32) with the helpers the city
// and the traffic use, so the same seed always builds the same Solara Bay.

export function createRandom(seed) {
  let a = seed | 0;
  function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next: random,
    /** A float in [min, max). */
    range(min, max) {
      return min + random() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return Math.floor(min + random() * (max - min + 1));
    },
    /** One element of an array. */
    pick(list) {
      return list[Math.floor(random() * list.length)];
    },
    /** True with probability p. */
    chance(p) {
      return random() < p;
    },
  };
}
