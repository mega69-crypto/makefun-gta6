// Everything that moves in Solara Bay: the player (on foot or in a car), the traffic
// cars and their drivers, the pedestrians, the pickups, the bullets and the
// particles. No drawing here and no police logic: step() advances the world one
// fixed step and returns the events the caller routes (crimes, pickups, shots).

import { CAR_TYPES, PED_COUNT, PICKUP_COUNT, PLAYER, TRAFFIC_COUNT, WORLD } from './config.js';
import { ACTION_ENTER, ACTION_PUNCH, ACTION_SHOOT } from './input.js';
import { createCombat } from './combat.js';
import { isOnRoad, nearestRoadPoint } from './world.js';

const PED_COLORS = ['#e8a34c', '#c96a8a', '#7fb069', '#d0d0d0', '#e07b39', '#6a8ac9'];
const CAR_KEYS = Object.keys(CAR_TYPES);

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createEntities(city, random) {
  const player = {
    x: 400, y: 1180, angle: -Math.PI / 2, radius: PLAYER.radius,
    health: PLAYER.health, money: 0, ammo: PLAYER.startAmmo,
    onFoot: true, car: null, speed: 0,
    punchCooldown: 0, pistolCooldown: 0, invulnerable: 0, hurtFlash: 0,
  };

  const cars = [];
  const peds = [];
  const pickups = [];
  const particles = [];
  const bullets = [];
  let carId = 0;

  function makeCar(type, x, y, angle, driver) {
    const spec = CAR_TYPES[type];
    const car = {
      id: carId += 1, type, x, y, angle, speed: 0,
      length: spec.length, width: spec.width, color: spec.color, roof: spec.roof,
      driver, parked: driver === null, damage: 0, smokeTimer: 0,
      axis: null, line: 0, dir: 1, lane: 16, turnCooldown: 0, brakeTimer: 0,
    };
    cars.push(car);
    return car;
  }

  function spawnTrafficCar(near) {
    const type = random.pick(['sedan', 'sedan', 'taxi', 'taxi', 'truck', 'coupe']);
    let point;
    if (near) {
      point = nearestRoadPoint(near.x + random.range(-500, 500), near.y + random.range(-500, 500));
    } else {
      point = city.randomRoadPoint();
    }
    const vertical = random.chance(0.5);
    const line = vertical ? point.x : point.y;
    const dir = random.chance(0.5) ? 1 : -1;
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeCar(type, point.x, point.y, angle, 'traffic');
    car.axis = vertical ? 'x' : 'y';
    car.line = line;
    car.dir = dir;
    car.lane = 16;
    car.speed = random.range(90, 150);
    return car;
  }

  function spawnParkedCar() {
    const point = city.randomRoadPoint();
    const vertical = random.chance(0.5);
    const angle = vertical ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
    const side = random.chance(0.5) ? 46 : -46;
    const x = vertical ? point.x + side : point.x;
    const y = vertical ? point.y : point.y + side;
    const type = random.pick(['sedan', 'sedan', 'taxi', 'coupe', 'truck']);
    const car = makeCar(type, x, y, angle, null);
    car.parked = true;
    return car;
  }

  function spawnPed(x, y, kind) {
    const point = x === undefined ? city.randomStreetPoint() : { x, y };
    peds.push({
      x: point.x, y: point.y, angle: random.range(0, Math.PI * 2),
      speed: random.range(35, 65), color: random.pick(PED_COLORS),
      kind: kind ?? 'civilian', state: 'walk', stateTimer: 0,
      target: null, health: 30, fallenTimer: 0, fleeX: 0, fleeY: 0,
    });
    return peds[peds.length - 1];
  }

  function spawnPickup(kind, x, y) {
    const point = x === undefined ? city.randomStreetPoint() : { x, y };
    pickups.push({ kind, x: point.x, y: point.y, active: true, bob: random.range(0, Math.PI * 2) });
  }

  function addParticles(x, y, count, color, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const s = random.range(speed * 0.3, speed);
      particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: random.range(life * 0.5, life), maxLife: life,
        color, size: random.range(size * 0.6, size * 1.4),
      });
    }
  }

  function reset() {
    cars.length = 0;
    peds.length = 0;
    pickups.length = 0;
    particles.length = 0;
    bullets.length = 0;
    carId = 0;
    player.x = 400;
    player.y = 1180;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.money = 0;
    player.ammo = PLAYER.startAmmo;
    player.onFoot = true;
    player.car = null;
    player.speed = 0;
    player.punchCooldown = 0;
    player.pistolCooldown = 0;
    player.invulnerable = 0;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnTrafficCar();
    for (let i = 0; i < 5; i += 1) spawnParkedCar();
    for (let i = 0; i < PED_COUNT; i += 1) spawnPed();
    spawnPickup('health');
    spawnPickup('ammo');
    spawnPickup('ammo');
    spawnPickup('cash');
    spawnPickup('cash');
    spawnPickup('health');
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of cars) {
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function stepPlayer(dt, controls, events) {
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.pistolCooldown > 0) player.pistolCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.hurtFlash > 0) player.hurtFlash -= dt;

    if (player.onFoot) {
      const speed = controls.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const steer = controls.steer;
      player.speed = Math.hypot(steer.x, steer.y) > 0.1 ? speed : 0;
      if (player.speed > 0) {
        player.angle = angleTo(0, 0, steer.x, steer.y);
        const nx = player.x + steer.x * speed * dt;
        const ny = player.y + steer.y * speed * dt;
        const resolved = city.resolveCircle(nx, ny, player.radius);
        player.x = resolved.x;
        player.y = resolved.y;
      }
      if (controls.actions & ACTION_ENTER) {
        const car = nearestCar(player.x, player.y, 52);
        if (car) {
          player.onFoot = false;
          player.car = car;
          car.driver = 'player';
          car.parked = false;
          car.speed = 0;
          if (car.occupant) {
            // The driver bails out and runs.
            const driver = spawnPed(car.x + 30, car.y + 30, 'civilian');
            driver.state = 'flee';
            driver.stateTimer = 3;
            driver.fleeX = car.x + 200;
            driver.fleeY = car.y + 200;
            car.occupant = null;
            events.push({ kind: 'crime', stars: 1, reason: 'stole a car' });
          }
        }
      }
      if (controls.actions & ACTION_PUNCH && player.punchCooldown <= 0) {
        player.punchCooldown = PLAYER.punchCooldown;
        const aim = controls.aimAngle !== null && controls.aimAngle !== undefined ? controls.aimAngle : player.angle;
        combat.punch(player, aim, events);
        addParticles(player.x + Math.cos(aim) * 26, player.y + Math.sin(aim) * 26, 4, '#ffffff', 120, 0.25, 3);
      }
      if (controls.actions & ACTION_SHOOT && player.pistolCooldown <= 0) {
        if (player.ammo > 0) {
          player.ammo -= 1;
          player.pistolCooldown = PLAYER.pistolCooldown;
          const aim = controls.aimAngle !== null && controls.aimAngle !== undefined ? controls.aimAngle : player.angle;
          bullets.push({
            x: player.x + Math.cos(aim) * 18, y: player.y + Math.sin(aim) * 18,
            vx: Math.cos(aim) * 720, vy: Math.sin(aim) * 720,
            life: 0.9, owner: 'player', damage: PLAYER.pistolDamage,
          });
          addParticles(player.x + Math.cos(aim) * 20, player.y + Math.sin(aim) * 20, 5, '#ffe08a', 200, 0.15, 3);
          events.push({ kind: 'shot', by: 'player' });
        } else {
          events.push({ kind: 'dryfire' });
        }
      }
    } else {
      // Driving the player's car.
      const car = player.car;
      const spec = CAR_TYPES[car.type];
      const steer = controls.steer;
      const forward = steer.y < -0.1 ? 1 : steer.y > 0.1 ? -0.6 : 0;
      const turning = steer.x;
      if (forward !== 0) {
        car.speed += forward * spec.accel * dt;
      } else {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 160 * dt);
      }
      car.speed = Math.max(-spec.reverse, Math.min(spec.topSpeed, car.speed));
      const turnRate = spec.turn * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed || 1);
      car.angle += turning * turnRate * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, y: car.y };
      const resolved = city.resolveCircle(nx, ny, car.width * 0.75);
      car.x = resolved.x;
      car.y = resolved.y;
      if ((resolved.x !== nx || resolved.y !== ny) && Math.abs(car.speed) > 60) {
        car.damage += 4;
        car.speed *= 0.4;
        addParticles(car.x, car.y, 6, '#c9c9c9', 160, 0.4, 4);
        events.push({ kind: 'crash', hard: Math.abs(car.speed) > 150 });
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = Math.abs(car.speed);
      if (Math.abs(car.speed) > 40 && random.chance(0.25)) {
        particles.push({
          x: car.x - Math.cos(car.angle) * car.length * 0.4 + random.range(-6, 6),
          y: car.y - Math.sin(car.angle) * car.length * 0.4 + random.range(-6, 6),
          vx: 0, vy: 0, life: 0.7, maxLife: 0.7, color: 'rgba(60,60,60,0.5)', size: 5,
        });
      }
      if (car.damage > 60 && car.smokeTimer <= 0) {
        car.smokeTimer = 0.25;
        particles.push({
          x: car.x + random.range(-8, 8), y: car.y + random.range(-8, 8),
          vx: random.range(-10, 10), vy: random.range(-30, -10),
          life: 1.1, maxLife: 1.1, color: 'rgba(80,80,80,0.6)', size: 7,
        });
      }
      if (car.smokeTimer > 0) car.smokeTimer -= dt;
      if (controls.actions & ACTION_SHOOT && player.pistolCooldown <= 0) {
        // Drive-by: the pistol fires from the car, aimed with the mouse or,
        // without one, straight ahead down the road.
        if (player.ammo > 0) {
          player.ammo -= 1;
          player.pistolCooldown = PLAYER.pistolCooldown;
          const aim = controls.aimAngle !== null && controls.aimAngle !== undefined ? controls.aimAngle : car.angle;
          bullets.push({
            x: car.x + Math.cos(aim) * 24, y: car.y + Math.sin(aim) * 24,
            vx: Math.cos(aim) * 720, vy: Math.sin(aim) * 720,
            life: 0.9, owner: 'player', damage: PLAYER.pistolDamage,
          });
          addParticles(car.x + Math.cos(aim) * 26, car.y + Math.sin(aim) * 26, 5, '#ffe08a', 200, 0.15, 3);
          events.push({ kind: 'shot', by: 'player' });
        } else {
          events.push({ kind: 'dryfire' });
        }
      }
      if (controls.actions & ACTION_ENTER) {
        // Step out beside the car.
        const side = car.angle + Math.PI / 2;
        const px = car.x + Math.cos(side) * 30;
        const py = car.y + Math.sin(side) * 30;
        const resolvedOut = city.resolveCircle(px, py, player.radius);
        player.x = resolvedOut.x;
        player.y = resolvedOut.y;
        player.onFoot = true;
        player.car = null;
        car.driver = null;
        car.parked = true;
        car.speed = 0;
      }
    }
    return events;
  }

  function hurtPed(ped, damage, by, events) {
    ped.health -= damage;
    addParticles(ped.x, ped.y, 5, '#e5534b', 140, 0.3, 3);
    if (ped.health <= 0) {
      ped.state = 'fallen';
      ped.fallenTimer = 6;
      if (by === 'player') {
        events.push({ kind: 'crime', stars: 1, reason: 'hurt a pedestrian' });
        events.push({ kind: 'pedDown', kind2: ped.kind });
      }
    } else {
      ped.state = 'flee';
      ped.stateTimer = 3;
      ped.fleeX = ped.x + (ped.x - player.x);
      ped.fleeY = ped.y + (ped.y - player.y);
    }
  }

  function hurtPlayer(damage, events) {
    if (player.invulnerable > 0 || player.health <= 0) return;
    player.health -= damage;
    player.invulnerable = 0.5;
    player.hurtFlash = 0.4;
    addParticles(player.x, player.y, 6, '#e5534b', 160, 0.35, 4);
    events.push({ kind: 'playerHurt', damage });
    if (player.health <= 0) {
      player.health = 0;
      events.push({ kind: 'playerDown' });
    }
  }

  function stepTraffic(dt, events) {
    for (const car of cars) {
      if (car.driver !== 'traffic') continue;
      if (car.brakeTimer > 0) {
        car.brakeTimer -= dt;
        car.speed = Math.max(0, car.speed - 300 * dt);
      } else {
        car.speed += (130 - car.speed) * 0.5 * dt;
      }
      // Slow down for a car ahead on the same road.
      for (const other of cars) {
        if (other === car || other.driver === null) continue;
        const ahead = car.axis === 'x'
          ? Math.abs(other.y - car.y) < 40 && ((other.x - car.x) * car.dir > 0) && ((other.x - car.x) * car.dir < 90)
          : Math.abs(other.x - car.x) < 40 && ((other.y - car.y) * car.dir > 0) && ((other.y - car.y) * car.dir < 90);
        if (ahead) {
          car.speed = Math.max(0, car.speed - 260 * dt);
          car.brakeTimer = 0.2;
        }
      }
      const stepX = car.axis === 'x' ? Math.cos(car.angle) * car.speed * dt : 0;
      const stepY = car.axis === 'y' ? Math.sin(car.angle) * car.speed * dt : 0;
      car.x += stepX;
      car.y += stepY;
      // Keep on the lane.
      if (car.axis === 'x') car.y += (car.line + car.lane - car.y) * Math.min(1, 4 * dt);
      else car.x += (car.line + car.lane - car.x) * Math.min(1, 4 * dt);
      // Turn at an intersection sometimes, or turn around at the world edge.
      car.turnCooldown -= dt;
      if (car.turnCooldown <= 0) {
        const nearCross = car.axis === 'x'
          ? [200, 500, 800, 1100, 1400].some((ry) => Math.abs(car.y - ry) < 26)
          : [200, 600, 1000, 1400, 1800, 2200].some((rx) => Math.abs(car.x - rx) < 26);
        const atEdge = car.x < 60 || car.x > WORLD.width - 60 || car.y < 60 || car.y > WORLD.height - 60;
        if (atEdge || (nearCross && random.chance(0.02))) {
          if (car.axis === 'x') {
            const newLine = [200, 500, 800, 1100, 1400].reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
            car.axis = 'y';
            car.line = newLine;
            car.dir = random.chance(0.5) ? 1 : -1;
            car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            car.lane = car.dir > 0 ? -16 : 16;
          } else {
            const newLine = [200, 600, 1000, 1400, 1800, 2200].reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
            car.axis = 'x';
            car.line = newLine;
            car.dir = random.chance(0.5) ? 1 : -1;
            car.angle = car.dir > 0 ? 0 : Math.PI;
            car.lane = car.dir > 0 ? 16 : -16;
          }
          car.turnCooldown = 2;
        }
      }
      // A traffic car that hits the player on foot is a crime scene for the driver, not the player.
      if (player.onFoot && dist2(car.x, car.y, player.x, player.y) < 30 * 30) {
        hurtPlayer(12, events);
        car.brakeTimer = 1;
      }
      // Running over a pedestrian.
      for (const ped of peds) {
        if (ped.state === 'fallen') continue;
        if (dist2(car.x, car.y, ped.x, ped.y) < 26 * 26) {
          if (car.driver === 'player') {
            hurtPed(ped, 100, 'player', events);
          } else {
            hurtPed(ped, 100, 'traffic', events);
          }
          car.brakeTimer = 0.8;
        }
      }
    }
  }

  function stepPeds(dt, events) {
    for (const ped of peds) {
      if (ped.state === 'fallen') {
        ped.fallenTimer -= dt;
        if (ped.fallenTimer <= 0) {
          ped.state = 'flee';
          ped.stateTimer = 4;
          ped.health = 30;
          ped.fleeX = ped.x + random.range(-300, 300);
          ped.fleeY = ped.y + random.range(-300, 300);
        }
        continue;
      }
      ped.stateTimer -= dt;
      let targetX = ped.target ? ped.target.x : ped.x;
      let targetY = ped.target ? ped.target.y : ped.y;
      let speed = ped.speed;
      if (ped.state === 'flee') {
        targetX = ped.fleeX;
        targetY = ped.fleeY;
        speed = 150;
        if (ped.stateTimer <= 0) {
          ped.state = 'walk';
          ped.target = null;
        }
      } else if (!ped.target || dist2(ped.x, ped.y, targetX, targetY) < 30 * 30) {
        const point = city.randomStreetPoint();
        ped.target = point;
        targetX = point.x;
        targetY = point.y;
      }
      // Flee from nearby gunfire or a speeding car (cops never flee).
      const threat = ped.kind !== 'cop' && bullets.length > 0 && dist2(ped.x, ped.y, player.x, player.y) < 400 * 400;
      if (threat && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.stateTimer = 2;
        ped.fleeX = ped.x + (ped.x - player.x) * 1.5;
        ped.fleeY = ped.y + (ped.y - player.y) * 1.5;
      }
      const a = angleTo(ped.x, ped.y, targetX, targetY);
      ped.angle = angleLerp(ped.angle, a, Math.min(1, 6 * dt));
      const nx = ped.x + Math.cos(ped.angle) * speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * speed * dt;
      const resolved = city.resolveCircle(nx, ny, 10);
      ped.x = resolved.x;
      ped.y = resolved.y;
    }
  }

  function stepBullets(dt, events) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && city.collides(b.x, b.y, 2)) {
        addParticles(b.x, b.y, 4, '#ffe08a', 120, 0.2, 2);
        dead = true;
      }
      if (!dead && b.owner === 'player') {
        for (const ped of peds) {
          if (ped.state === 'fallen') continue;
          if (dist2(b.x, b.y, ped.x, ped.y) < 14 * 14) {
            hurtPed(ped, b.damage, 'player', events);
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const car of cars) {
            if (car.driver === 'player') continue;
            if (dist2(b.x, b.y, car.x, car.y) < 24 * 24) {
              car.damage += b.damage;
              addParticles(b.x, b.y, 4, '#c9c9c9', 140, 0.25, 3);
              if (car.driver === 'police') events.push({ kind: 'crime', stars: 1, reason: 'shot a police car' });
              dead = true;
              break;
            }
          }
        }
      } else if (!dead && b.owner === 'cop') {
        if (dist2(b.x, b.y, player.x, player.y) < 14 * 14) {
          hurtPlayer(b.damage, events);
          dead = true;
        }
      }
      if (dead) bullets.splice(i, 1);
    }
  }

  function stepPickups(dt, events) {
    for (const pickup of pickups) {
      if (!pickup.active) continue;
      pickup.bob += dt * 3;
      const range = player.onFoot ? 30 : 44;
      if (dist2(pickup.x, pickup.y, player.x, player.y) < range * range) {
        pickup.active = false;
        if (pickup.kind === 'health') {
          player.health = Math.min(PLAYER.health, player.health + 40);
          events.push({ kind: 'pickup', what: 'health' });
        } else if (pickup.kind === 'ammo') {
          player.ammo += 12;
          events.push({ kind: 'pickup', what: 'ammo' });
        } else {
          const value = 25 + Math.floor(random.next() * 40);
          player.money += value;
          events.push({ kind: 'pickup', what: 'cash', value });
        }
      }
    }
    // Slowly restock pickups that were taken.
    if (random.chance(dt * 0.05)) {
      const inactive = pickups.filter((p) => !p.active);
      if (inactive.length > 0 && pickups.filter((p) => p.active).length < PICKUP_COUNT) {
        const point = city.randomStreetPoint();
        const p = inactive[0];
        p.x = point.x;
        p.y = point.y;
        p.active = true;
      }
    }
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  function step(dt, controls, events) {
    stepPlayer(dt, controls, events);
    stepTraffic(dt, events);
    stepPeds(dt, events);
    stepBullets(dt, events);
    stepPickups(dt, events);
    stepParticles(dt);
    return events;
  }

  const state = { player, cars, peds, pickups, particles, bullets };
  const combat = createCombat({ state, hurtPed, addParticles });

  reset();

  return {
    state,
    reset,
    step,
    nearestCar,
    spawnPed,
    spawnPickup,
    spawnTrafficCar,
    addParticles,
    hurtPlayer,
    hurtPed,
    isOnRoad,
  };
}
