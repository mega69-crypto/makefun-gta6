// The screenshot scenes behind ?shot=chase|foot|drive|mission. Each one sets the
// real game up in a chosen state — a player, a wanted level, a mission, police on
// the street — then plays the real rules forward for a few seconds with a simple
// autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame. The cover is the chase: wanted stars, the
// minimap, a mission objective and the police all in one frame.

import { CAR_TYPES, PLACES, STEP } from './config.js';

function putPlayerInCar(game, type, x, y, angle) {
  const { entities, city } = game;
  const car = entities.state.cars.find((c) => c.type === type && !c.driver) ?? null;
  const chosen = car ?? entities.state.cars[0];
  chosen.type = type;
  const spec = CAR_TYPES[type];
  chosen.length = spec.length;
  chosen.width = spec.width;
  chosen.color = spec.color;
  chosen.roof = spec.roof;
  chosen.x = x;
  chosen.y = y;
  chosen.angle = angle;
  chosen.speed = 180;
  chosen.driver = 'player';
  chosen.parked = false;
  const player = entities.state.player;
  player.onFoot = false;
  player.car = chosen;
  player.x = x;
  player.y = y;
  player.angle = angle;
  return chosen;
}

function putPlayerOnFoot(game, x, y, angle) {
  const player = game.entities.state.player;
  player.onFoot = true;
  player.car = null;
  player.x = x;
  player.y = y;
  player.angle = angle;
  player.health = 100;
}

function addPoliceCar(game, x, y, angle) {
  const spec = CAR_TYPES.cruiser;
  game.entities.state.cars.push({
    id: 90000 + Math.floor(Math.random() * 1000), type: 'cruiser',
    x, y, angle, speed: 200,
    length: spec.length, width: spec.width, color: spec.color, roof: spec.roof,
    driver: 'police', parked: false, damage: 0, smokeTimer: 0,
    axis: null, line: 0, dir: 1, lane: 16, turnCooldown: 0, brakeTimer: 0,
    shootCooldown: 1, gotOut: true, roadblock: false,
  });
}

function addFootCop(game, x, y) {
  const cop = game.entities.spawnPed(x, y, 'cop');
  cop.speed = 175;
  cop.health = 50;
  cop.color = '#2f6fd0';
  return cop;
}

/** Play the real rules forward for `seconds`, steering with `drive` each step. */
function simulate(game, seconds, drive) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = [];
    const controls = drive(i * STEP);
    game.entities.step(STEP, controls, events);
    game.police.step(STEP, events);
    game.missions.step(STEP, events);
    game.clock.minutes += (STEP * 0.5) % (24 * 60);
  }
}

function roadControls() {
  return {
    steer: { x: 0, y: -1 },
    sprint: false,
    actions: 0,
    aimAngle: null,
  };
}

function idleControls() {
  return {
    steer: { x: 0, y: 0 },
    sprint: false,
    actions: 0,
    aimAngle: null,
  };
}

/**
 * Set the game to the named scene and return the screen to draw. Unknown names
 * stage the chase (the cover).
 */
export function stageShot(name, game) {
  const { entities, police, missions, clock } = game;
  const player = entities.state.player;
  player.money = 1250;
  player.ammo = 24;

  if (name === 'foot') {
    clock.minutes = 10 * 60;
    missions.setProgress(0, 0, 0);
    putPlayerOnFoot(game, 1000, 760, Math.PI / 2);
    // A taxi waits across the road; traffic rolls by.
    const taxi = entities.state.cars.find((c) => c.type === 'taxi');
    if (taxi) {
      taxi.x = 1060;
      taxi.y = 800;
      taxi.angle = 0;
      taxi.driver = null;
      taxi.parked = true;
    }
    simulate(game, 4, idleControls);
    return;
  }

  if (name === 'drive') {
    clock.minutes = 14 * 60;
    missions.setProgress(0, 1, 0);
    // Start on the west side of the y=800 road and drive east for four seconds:
    // any longer and the car reaches the edge of the city, where the camera
    // shows empty ground past the world instead of streets.
    putPlayerInCar(game, 'taxi', 600, 800, 0);
    simulate(game, 4, roadControls);
    return;
  }

  if (name === 'mission') {
    clock.minutes = 17 * 60;
    missions.setProgress(3, 1, 5);
    police.wanted = 3;
    putPlayerOnFoot(game, PLACES.bank.x - 20, PLACES.bank.y + 30, -Math.PI / 2);
    addPoliceCar(game, PLACES.bank.x - 160, PLACES.bank.y + 120, Math.PI / 4);
    addPoliceCar(game, PLACES.bank.x + 180, PLACES.bank.y - 100, -Math.PI * 0.75);
    addFootCop(game, PLACES.bank.x + 60, PLACES.bank.y + 90);
    simulate(game, 1.5, idleControls);
    return;
  }

  // Chase (the cover): a taxi, three stars, two cruisers on the player's tail,
  // a foot cop closing in, dusk light, the package run still on. The run starts
  // on the west side of the y=800 road and lasts four seconds, so the chase
  // ends mid-city with streets on every side instead of at the world's edge.
  clock.minutes = 19 * 60;
  missions.setProgress(0, 1, 0);
  police.wanted = 3;
  putPlayerInCar(game, 'taxi', 600, 800, 0);
  addPoliceCar(game, 520, 800, 0);
  addPoliceCar(game, 480, 830, 0);
  addFootCop(game, 680, 760);
  simulate(game, 4, roadControls);
}
