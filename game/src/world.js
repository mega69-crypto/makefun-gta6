// Solara Bay itself: the road grid, the blocks of buildings, Palm Park, the beach
// and the docks, all generated from one seed so the city never changes. This file
// owns the layout and the collision questions; it draws nothing and knows nothing
// about the player, the police or the missions.

import { PLACES, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';

const SIDEWALK = 14;
const BEACH_TOP = 1600;
const WATER_TOP = 1720;
const DOCKS_LEFT = 2264;

const BUILDING_COLORS = ['#b98a5e', '#7d9bb5', '#c2b49a', '#a87f6d', '#8fa98f', '#b5a37d'];
const ROOF_COLORS = ['#6b4a2f', '#4a5a6b', '#7d6b4f', '#5a3a3a'];

/** True when the point is on a road (including the road's width). */
export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_WIDTH / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_WIDTH / 2) return true;
  return false;
}

/** The nearest point on any road centreline to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestDist) {
      bestDist = d;
      best = { x: rx, y: Math.max(0, Math.min(WORLD.height, y)) };
    }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestDist) {
      bestDist = d;
      best = { x: Math.max(0, Math.min(WORLD.width, x)), y: ry };
    }
  }
  return best;
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const containers = [];

  function addBuilding(x, y, w, h, label) {
    const color = random.pick(BUILDING_COLORS);
    buildings.push({
      x, y, w, h,
      color,
      roof: random.pick(ROOF_COLORS),
      label: label ?? null,
      windows: random.int(2, 5),
    });
  }

  // Blocks: the gaps between neighbouring roads, plus the edge strips.
  const edgesX = [0, ...ROADS_X, WORLD.width];
  const edgesY = [0, ...ROADS_Y, WORLD.height];
  for (let bx = 0; bx < edgesX.length - 1; bx += 1) {
    for (let by = 0; by < edgesY.length - 1; by += 1) {
      const left = edgesX[bx] + (bx === 0 ? 0 : ROAD_WIDTH / 2) + SIDEWALK;
      const right = edgesX[bx + 1] - (bx === edgesX.length - 2 ? 0 : ROAD_WIDTH / 2) - SIDEWALK;
      const top = edgesY[by] + (by === 0 ? 0 : ROAD_WIDTH / 2) + SIDEWALK;
      const bottom = edgesY[by + 1] - (by === edgesY.length - 2 ? 0 : ROAD_WIDTH / 2) - SIDEWALK;
      if (right - left < 60 || bottom - top < 60) continue;
      // Palm Park takes the block between x 600-1000 and y 800-1100.
      if (left >= 600 && right <= 1000 && top >= 800 && bottom <= 1100) {
        for (let i = 0; i < 16; i += 1) {
          trees.push({ x: random.range(left + 20, right - 20), y: random.range(top + 20, bottom - 20), r: random.range(9, 15) });
        }
        continue;
      }
      // The beach strip stays open sand and water.
      if (top >= BEACH_TOP) continue;
      // The docks strip holds containers, not buildings: the easternmost column
      // of blocks reaches past the docks line, so check its right edge.
      if (right >= DOCKS_LEFT) {
        for (let i = 0; i < 6; i += 1) {
          containers.push({
            x: random.range(left + 10, right - 70),
            y: random.range(top + 10, bottom - 30),
            w: random.range(50, 70),
            h: 26,
            color: random.pick(['#c25e3a', '#3a7d5c', '#4a6b8a', '#b5a23a']),
          });
        }
        continue;
      }
      // One or two buildings per block, with a gap between them.
      const count = random.chance(0.6) ? 2 : 1;
      if (count === 1) {
        addBuilding(left + 8, top + 8, right - left - 16, bottom - top - 16);
      } else {
        const vertical = (right - left) > (bottom - top);
        if (vertical) {
          const split = left + (right - left) * random.range(0.4, 0.6);
          addBuilding(left + 8, top + 8, split - left - 16, bottom - top - 16);
          addBuilding(split + 8, top + 8, right - split - 16, bottom - top - 16);
        } else {
          const split = top + (bottom - top) * random.range(0.4, 0.6);
          addBuilding(left + 8, top + 8, right - left - 16, split - top - 16);
          addBuilding(left + 8, split + 8, right - left - 16, bottom - split - 16);
        }
      }
    }
  }

  // Landmark buildings sit on their named spots (drawn with their label).
  addBuilding(PLACES.bank.x - 70, PLACES.bank.y - 45, 140, 90, 'Solara Bank');
  addBuilding(PLACES.hospital.x - 70, PLACES.hospital.y - 45, 140, 90, 'General Hospital');
  addBuilding(PLACES.hideout.x - 40, PLACES.hideout.y - 30, 80, 60, 'Hideout');
  addBuilding(PLACES.spray.x - 40, PLACES.spray.y - 30, 80, 60, 'Pay N Spray');

  // A few palm trees along the beach.
  for (let i = 0; i < 12; i += 1) {
    trees.push({ x: random.range(80, WORLD.width - 80), y: random.range(BEACH_TOP + 20, WATER_TOP - 20), r: random.range(9, 14) });
  }

  /** Circle (x, y, r) against buildings, containers and the world edge. */
  function collides(x, y, r) {
    if (x - r < 0 || x + r > WORLD.width || y - r < 0 || y + r > WORLD.height) return true;
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    for (const c of containers) {
      if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return true;
    }
    return false;
  }

  /** Push a circle out of whatever it overlaps; returns the corrected position. */
  function resolveCircle(x, y, r) {
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else if (d2 <= 0.0001) {
        // Centre inside the building: push out along the shortest side.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) x = b.x - r;
        else if (min === right) x = b.x + b.w + r;
        else if (min === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
    for (const c of containers) {
      const cx = Math.max(c.x, Math.min(x, c.x + c.w));
      const cy = Math.max(c.y, Math.min(y, c.y + c.h));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      }
    }
    x = Math.max(r, Math.min(WORLD.width - r, x));
    y = Math.max(r, Math.min(WORLD.height - r, y));
    return { x, y };
  }

  /** A random point on a road, for spawning traffic and pedestrians. */
  function randomRoadPoint() {
    if (random.chance(0.5)) {
      return { x: random.pick(ROADS_X), y: random.range(40, WORLD.height - 40) };
    }
    return { x: random.range(40, WORLD.width - 40), y: random.pick(ROADS_Y) };
  }

  /** A random walkable point (not inside a building) near the roads. */
  function randomStreetPoint() {
    for (let tries = 0; tries < 20; tries += 1) {
      const p = randomRoadPoint();
      p.x += random.range(-50, 50);
      p.y += random.range(-50, 50);
      if (!collides(p.x, p.y, 14)) return p;
    }
    return { x: 1000, y: 800 };
  }

  return {
    buildings,
    trees,
    containers,
    beachTop: BEACH_TOP,
    waterTop: WATER_TOP,
    docksLeft: DOCKS_LEFT,
    collides,
    resolveCircle,
    randomRoadPoint,
    randomStreetPoint,
  };
}
