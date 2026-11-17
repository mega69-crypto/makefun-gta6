// The wanted level and the police who answer it. Foot cops chase and punch;
// police cars chase, ram and (at three stars and up) shoot. The heat dies down
// when no cop can see the player for a while, or at the Pay N Spray and the
// Hideout. Cops are ordinary pedestrians and cars in the entities' lists, so the
// rest of the game treats them like anything else that moves.

import { CAR_TYPES, PLACES, WANTED } from './config.js';
import { nearestRoadPoint } from './world.js';

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createPolice(city, random, entities) {
  const state = entities.state;
  let wanted = 0;
  let unseenTimer = 0;
  let decayTimer = 0;
  let sprayCooldown = 0;
  let roadblockUp = false;
  let copId = 0;

  function cops() {
    return state.peds.filter((p) => p.kind === 'cop' && p.state !== 'fallen');
  }

  function policeCars() {
    return state.cars.filter((c) => c.driver === 'police');
  }

  function addWanted(stars, events) {
    const before = wanted;
    wanted = Math.min(5, wanted + stars);
    unseenTimer = 0;
    decayTimer = 0;
    if (wanted > before) events.push({ kind: 'wantedUp', level: wanted });
    return wanted;
  }

  function spawnFootCop(player, events) {
    const point = nearestRoadPoint(
      player.x + random.range(-450, 450),
      player.y + random.range(-450, 450),
    );
    const cop = entities.spawnPed(point.x, point.y, 'cop');
    cop.speed = 175;
    cop.health = 50;
    cop.color = '#2f6fd0';
    return cop;
  }

  function spawnPoliceCar(player, events) {
    const point = nearestRoadPoint(
      player.x + random.range(-500, 500),
      player.y + random.range(-500, 500),
    );
    const spec = CAR_TYPES.cruiser;
    const car = {
      id: 10000 + (copId += 1), type: 'cruiser',
      x: point.x, y: point.y, angle: 0, speed: 0,
      length: spec.length, width: spec.width, color: spec.color, roof: spec.roof,
      driver: 'police', parked: false, damage: 0, smokeTimer: 0,
      axis: null, line: 0, dir: 1, lane: 16, turnCooldown: 0, brakeTimer: 0,
      shootCooldown: random.range(0.5, 1.5), gotOut: false,
    };
    state.cars.push(car);
    return car;
  }

  function spawnRoadblock(player, events) {
    const ahead = nearestRoadPoint(player.x, player.y);
    for (const offset of [-40, 40]) {
      const car = {
        id: 10000 + (copId += 1), type: 'cruiser',
        x: ahead.x + offset, y: ahead.y, angle: Math.PI / 2, speed: 0,
        length: CAR_TYPES.cruiser.length, width: CAR_TYPES.cruiser.width,
        color: CAR_TYPES.cruiser.color, roof: CAR_TYPES.cruiser.roof,
        driver: 'police', parked: true, damage: 0, smokeTimer: 0,
        axis: null, line: 0, dir: 1, lane: 16, turnCooldown: 0, brakeTimer: 0,
        shootCooldown: 2, gotOut: true, roadblock: true,
      };
      state.cars.push(car);
    }
    roadblockUp = true;
  }

  function clearRoadblock() {
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      if (state.cars[i].roadblock) state.cars.splice(i, 1);
    }
    roadblockUp = false;
  }

  function step(dt, events) {
    const player = state.player;

    // Does any cop see the player?
    let seen = false;
    for (const cop of cops()) {
      if (dist2(cop.x, cop.y, player.x, player.y) < 520 * 520) { seen = true; break; }
    }
    if (!seen) {
      for (const car of policeCars()) {
        if (dist2(car.x, car.y, player.x, player.y) < 520 * 520) { seen = true; break; }
      }
    }
    if (seen) {
      unseenTimer = 0;
      decayTimer = 0;
    } else if (wanted > 0) {
      unseenTimer += dt;
      if (unseenTimer > WANTED.decayDelay) {
        decayTimer += dt;
        if (decayTimer >= WANTED.decayInterval) {
          decayTimer = 0;
          wanted -= 1;
          events.push({ kind: 'wantedDown', level: wanted });
        }
      }
    }

    // Pay N Spray clears two stars for $50; the Hideout clears them all on foot.
    // The spray's own building pushes a car out to its edge, so the trigger
    // reaches a little past the building. One spray per visit: the cooldown
    // stops it charging $50 every frame while the car sits in the zone.
    if (sprayCooldown > 0) sprayCooldown -= dt;
    if (!player.onFoot && player.car && dist2(player.x, player.y, PLACES.spray.x, PLACES.spray.y) < 90 * 90) {
      if (wanted > 0 && player.money >= 50 && sprayCooldown <= 0) {
        player.money -= 50;
        wanted = Math.max(0, wanted - 2);
        sprayCooldown = 2;
        events.push({ kind: 'respray', level: wanted });
      }
    }
    if (player.onFoot && dist2(player.x, player.y, PLACES.hideout.x, PLACES.hideout.y) < 70 * 70) {
      if (wanted > 0 && !seen) {
        wanted = 0;
        events.push({ kind: 'layLow', level: 0 });
      }
    }

    // Keep the right number of cops on the street.
    const wantFoot = WANTED.footCops[wanted];
    const wantCars = WANTED.carCops[wanted];
    while (cops().length < wantFoot) spawnFootCop(player, events);
    while (policeCars().length < wantCars) spawnPoliceCar(player, events);
    // Too many: the extras give up and walk away (foot) or drive off (cars).
    const extraFoot = cops().slice(wantFoot);
    for (const cop of extraFoot) {
      cop.kind = 'civilian';
      cop.state = 'flee';
      cop.stateTimer = 2;
      cop.speed = 90;
    }
    const extraCars = policeCars().slice(wantCars);
    for (const car of extraCars) {
      car.driver = 'traffic';
      car.axis = 'x';
      car.line = car.y;
      car.dir = 1;
      car.angle = 0;
      car.speed = 130;
    }

    // Roadblock at four stars and up.
    if (wanted >= WANTED.roadblockAt && !roadblockUp) spawnRoadblock(player, events);
    if (wanted < WANTED.roadblockAt && roadblockUp) clearRoadblock();

    // Foot cops: run at the player and punch when close.
    for (const cop of cops()) {
      cop.target = { x: player.x, y: player.y };
      cop.state = 'walk';
      cop.stateTimer = 0.5;
      if (dist2(cop.x, cop.y, player.x, player.y) < 30 * 30) {
        if (player.onFoot) {
          entities.hurtPlayer(9, events);
          cop.stateTimer = 0.6;
          cop.target = { x: cop.x, y: cop.y };
        }
      }
    }

    // Police cars: steer at the player, ram, and shoot at three stars and up.
    for (const car of policeCars()) {
      if (car.roadblock) continue;
      const spec = CAR_TYPES.cruiser;
      const desired = Math.atan2(player.y - car.y, player.x - car.x);
      let diff = desired - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-spec.turn * dt, Math.min(spec.turn * dt, diff));
      car.speed = Math.min(spec.topSpeed, car.speed + spec.accel * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const resolved = city.resolveCircle(nx, ny, car.width * 0.75);
      car.x = resolved.x;
      car.y = resolved.y;
      // Ram the player's car, or the player on foot.
      if (player.car && dist2(car.x, car.y, player.x, player.y) < 46 * 46) {
        player.car.damage += 3;
        car.speed *= 0.5;
        entities.addParticles(player.x, player.y, 4, '#c9c9c9', 120, 0.3, 3);
      } else if (player.onFoot && dist2(car.x, car.y, player.x, player.y) < 40 * 40) {
        entities.hurtPlayer(10, events);
        car.speed *= 0.3;
        // One cop gets out and joins the chase on foot.
        if (!car.gotOut) {
          car.gotOut = true;
          spawnFootCop(player, events);
        }
      }
      // Open fire at three stars and up.
      if (wanted >= WANTED.shootAt) {
        car.shootCooldown -= dt;
        if (car.shootCooldown <= 0 && dist2(car.x, car.y, player.x, player.y) < 430 * 430) {
          car.shootCooldown = 1.3;
          const aim = Math.atan2(player.y - car.y, player.x - car.x) + (random.next() - 0.5) * 0.35;
          state.bullets.push({
            x: car.x + Math.cos(aim) * 26, y: car.y + Math.sin(aim) * 26,
            vx: Math.cos(aim) * 620, vy: Math.sin(aim) * 620,
            life: 0.9, owner: 'cop', damage: 8,
          });
          entities.addParticles(car.x + Math.cos(aim) * 28, car.y + Math.sin(aim) * 28, 4, '#ffe08a', 180, 0.12, 3);
        }
      }
      if (car.damage > 80) {
        // A wrecked cruiser is abandoned: its driver becomes a foot cop.
        car.driver = null;
        car.parked = true;
        spawnFootCop(player, events);
      }
    }

    // Cops far away and out of the heat are stood down.
    if (wanted === 0) {
      for (let i = state.peds.length - 1; i >= 0; i -= 1) {
        const ped = state.peds[i];
        if (ped.kind === 'cop' && dist2(ped.x, ped.y, player.x, player.y) > 900 * 900) {
          state.peds.splice(i, 1);
        }
      }
      for (let i = state.cars.length - 1; i >= 0; i -= 1) {
        const car = state.cars[i];
        if (car.driver === 'police' && dist2(car.x, car.y, player.x, player.y) > 900 * 900) {
          state.cars.splice(i, 1);
        }
      }
    }
    return events;
  }

  return {
    get wanted() {
      return wanted;
    },
    set wanted(value) {
      wanted = Math.max(0, Math.min(5, value));
    },
    addWanted,
    step,
  };
}
