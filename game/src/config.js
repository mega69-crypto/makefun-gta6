// Every tuning number, colour and name in one place. Solara Bay is a fictional
// sun-soaked coastal city, 2400 by 1800 world units, drawn top-down on a canvas.
// Nothing here names a real place or any commercial game.

export const WORLD = { width: 2400, height: 1800 };

/** Road centrelines; roads are 64 units wide with two lanes. */
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200];
export const ROADS_Y = [200, 500, 800, 1100, 1400];
export const ROAD_WIDTH = 64;

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** City landmarks, by name, for missions and the minimap. */
export const PLACES = {
  hideout: { name: 'Hideout', x: 400, y: 1250 },
  bank: { name: 'Solara Bank', x: 1200, y: 650 },
  docks: { name: 'East Docks', x: 2280, y: 950 },
  park: { name: 'Palm Park', x: 800, y: 950 },
  hospital: { name: 'General Hospital', x: 800, y: 350 },
  spray: { name: 'Pay N Spray', x: 1400, y: 1250 },
  beach: { name: 'South Beach', x: 1200, y: 1700 },
};

export const PLAYER = {
  radius: 12,
  walkSpeed: 210,
  sprintSpeed: 330,
  health: 100,
  punchRange: 34,
  punchDamage: 15,
  punchCooldown: 0.45,
  pistolDamage: 26,
  pistolCooldown: 0.28,
  startAmmo: 12,
};

/** Vehicle types: speed in units/second, accel, turn rate, size, colour. */
export const CAR_TYPES = {
  sedan: { label: 'Sedan', topSpeed: 300, accel: 210, reverse: 120, turn: 2.9, length: 46, width: 22, color: '#c94f4f', roof: '#8f2f2f' },
  taxi: { label: 'Taxi', topSpeed: 315, accel: 220, reverse: 120, turn: 3.0, length: 46, width: 22, color: '#f2c94c', roof: '#2b2b2b' },
  cruiser: { label: 'Police Cruiser', topSpeed: 345, accel: 260, reverse: 130, turn: 3.2, length: 48, width: 22, color: '#2f6fd0', roof: '#eef1f5' },
  truck: { label: 'Truck', topSpeed: 230, accel: 150, reverse: 90, turn: 2.1, length: 62, width: 26, color: '#7a8a99', roof: '#55606c' },
  coupe: { label: 'Coupe', topSpeed: 360, accel: 250, reverse: 130, turn: 3.3, length: 44, width: 21, color: '#9b59d0', roof: '#5e2f86' },
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const PICKUP_COUNT = 6;

/** Wanted level: how many police spawn and how hard they press. */
export const WANTED = {
  decayDelay: 6, // seconds unseen before the level starts to fall
  decayInterval: 4, // seconds per star lost while hidden
  footCops: [0, 2, 3, 4, 5, 6],
  carCops: [0, 0, 2, 3, 4, 5],
  shootAt: 3, // stars at which police open fire
  roadblockAt: 4,
};

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Wheels for Vic',
    giver: 'Vic',
    intro: 'Vic needs a taxi and a package delivered to the East Docks. Grab a cab, then follow the gold marker.',
    reward: 250,
  },
  {
    id: 'heat',
    title: 'Heat Check',
    giver: 'Vic',
    intro: 'The cops are on you. Two stars. Lose them — stay out of sight and the heat dies down.',
    reward: 300,
  },
  {
    id: 'crew',
    title: 'Crew Call',
    giver: 'Vic',
    intro: 'Pick up the crew — two of them, waiting on the street — and bring them home to the Hideout.',
    reward: 400,
  },
  {
    id: 'score',
    title: 'The Big Score',
    giver: 'Vic',
    intro: 'Solara Bank. Get inside, hold the vault for 8 seconds, then lose the cops and get home. Big money.',
    reward: 800,
  },
];

export const PALETTE = {
  grass: '#5da24a',
  grassDark: '#4c8a3d',
  road: '#3a3f47',
  roadEdge: '#565d68',
  lane: '#d8c95c',
  sidewalk: '#8d8578',
  sand: '#e8d39a',
  water: '#2f7fb8',
  waterDeep: '#1f5f92',
  building: '#b98a5e',
  building2: '#7d9bb5',
  building3: '#c2b49a',
  roof: '#6b4a2f',
  park: '#4c8a3d',
  tree: '#2f6b2a',
  player: '#4fc3f7',
  playerDark: '#1f7fb8',
  ped: '#e8a34c',
  cop: '#2f6fd0',
  bullet: '#ffe08a',
  text: '#eef1f5',
  muted: '#aab2c0',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#58c472',
  panel: 'rgba(16, 20, 28, 0.82)',
  panelSolid: '#10141c',
  skyDay: 'rgba(255, 236, 180, 0.10)',
  skyDusk: 'rgba(255, 120, 60, 0.16)',
  skyNight: 'rgba(10, 20, 60, 0.28)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solara-bay.save.v1';

/** Game clock: starts at 09:00, one game-minute every 2 real seconds. */
export const CLOCK = { startMinutes: 9 * 60, minutesPerSecond: 0.5 };
