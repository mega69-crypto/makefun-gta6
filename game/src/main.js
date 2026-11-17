// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// five screens: title, play, paused, story complete and busted. Progress saves
// itself to localStorage every few seconds and whenever a job is finished.
//
// ?seed=N fixes the city. ?shot=chase|foot|drive|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { CLOCK, PLACES, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './world.js';
import { createEntities } from './entities.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_SHOOT, createInput,
} from './input.js';
import {
  SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { clearSave, readSave, writeSave } from './save.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = createCity(random);
const entities = createEntities(city, random);
const police = createPolice(city, random, entities);
const missions = createMissions(city, random, entities, police);
const audio = createAudio();
const input = createInput(canvas);
const renderer = createRenderer(canvas);

const player = entities.state.player;
const camera = { x: player.x, y: player.y };
const clock = { minutes: CLOCK.startMinutes };

let screen = SCREEN_TITLE;
let banner = null;
let bannerTimer = 0;
let elapsed = 0;
let saveTimer = 0;
let overTimer = 0;
let titlePan = 0;

const saved = readSave();
let hasSave = saved !== null;
let bestMoney = saved ? (saved.money ?? 0) : 0;

function announce(message) {
  status.textContent = message;
}

function showBanner(title, sub) {
  banner = { title, sub };
  bannerTimer = 4;
}

function formatClock(minutes) {
  const total = Math.floor(minutes) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function saveGame() {
  writeSave({
    money: player.money,
    missionsDone: missions.index,
    x: Math.round(player.x),
    y: Math.round(player.y),
    health: Math.round(player.health),
    ammo: player.ammo,
    minutes: Math.round(clock.minutes),
    wanted: police.wanted,
  });
  hasSave = true;
}

function startFresh() {
  entities.reset();
  police.wanted = 0;
  missions.reset();
  clock.minutes = CLOCK.startMinutes;
  camera.x = player.x;
  camera.y = player.y;
  banner = null;
  elapsed = 0;
  saveTimer = 0;
  screen = SCREEN_PLAY;
  announce('Playing. Vic has a job for you: steal a taxi.');
}

function continueGame() {
  if (!saved) {
    startFresh();
    return;
  }
  entities.reset();
  police.wanted = 0;
  missions.reset();
  player.money = saved.money ?? 0;
  player.x = saved.x ?? 400;
  player.y = saved.y ?? 1180;
  player.health = saved.health ?? 100;
  player.ammo = saved.ammo ?? 12;
  clock.minutes = saved.minutes ?? CLOCK.startMinutes;
  police.wanted = saved.wanted ?? 0;
  missions.setProgress(saved.missionsDone ?? 0, 0, 0);
  camera.x = player.x;
  camera.y = player.y;
  banner = null;
  elapsed = 0;
  saveTimer = 0;
  screen = SCREEN_PLAY;
  showBanner('Welcome back', `Picking up where you left off — $${player.money} in your pocket.`);
  announce('Welcome back to Solara Bay.');
}

function respawn() {
  player.health = 100;
  player.onFoot = true;
  player.car = null;
  player.x = PLACES.hospital.x;
  player.y = PLACES.hospital.y;
  police.wanted = 0;
  camera.x = player.x;
  camera.y = player.y;
  screen = SCREEN_PLAY;
  showBanner('Patched up', 'The hospital let you go. The city is still out there.');
  announce('Back on the street.');
}

function routeEvents(events) {
  for (const event of events) {
    if (event.kind === 'crime') {
      police.addWanted(event.stars, events);
    } else if (event.kind === 'shot') {
      if (event.by === 'player') audio.shoot();
    } else if (event.kind === 'pickup') {
      if (event.what === 'cash') audio.cash();
      else audio.pickup();
    } else if (event.kind === 'wantedUp') {
      audio.wantedUp();
    } else if (event.kind === 'playerHurt') {
      audio.hit();
    } else if (event.kind === 'crash' && event.hard) {
      audio.hit();
    } else if (event.kind === 'missionStart') {
      showBanner(event.title, event.intro);
      audio.click();
      announce(`${event.title}. ${event.intro}`);
    } else if (event.kind === 'missionComplete') {
      showBanner('Job done', `${event.title} — Vic paid you $${event.reward}.`);
      audio.missionDone();
      saveGame();
      announce(`Job done. $${event.reward} earned.`);
    } else if (event.kind === 'storyComplete') {
      overTimer = 2.5;
      audio.missionDone();
      saveGame();
    } else if (event.kind === 'playerDown') {
      audio.busted();
      screen = SCREEN_BUSTED;
      announce('Busted. The police caught up with you.');
    } else if (event.kind === 'crewPicked') {
      audio.pickup();
      announce(`Crew picked up: ${event.count} of 2.`);
    } else if (event.kind === 'respray' || event.kind === 'layLow') {
      audio.pickup();
    }
  }
  // Drain the queue: the same array is handed to the next step.
  events.length = 0;
}

function aimAngle() {
  const mouse = input.mouse();
  if (!mouse.inside) return null;
  const rect = canvas.getBoundingClientRect();
  const scaleX = renderer.view.width / Math.max(1, rect.width);
  const scaleY = renderer.view.height / Math.max(1, rect.height);
  const worldX = camera.x + (mouse.x * scaleX - renderer.view.width / 2) / renderer.view.scale;
  const worldY = camera.y + (mouse.y * scaleY - renderer.view.height / 2) / renderer.view.scale;
  return Math.atan2(worldY - player.y, worldX - player.x);
}

function updateCamera(dt) {
  const tx = player.x;
  const ty = player.y;
  const t = Math.min(1, 5 * dt);
  camera.x += (tx - camera.x) * t;
  camera.y += (ty - camera.y) * t;
  const halfW = renderer.view.width / 2 / renderer.view.scale;
  const halfH = renderer.view.height / 2 / renderer.view.scale;
  camera.x = halfW >= WORLD.width / 2 ? WORLD.width / 2 : Math.max(halfW, Math.min(WORLD.width - halfW, camera.x));
  camera.y = halfH >= WORLD.height / 2 ? WORLD.height / 2 : Math.max(halfH, Math.min(WORLD.height - halfH, camera.y));
}

function buildHud() {
  const objective = missions.currentObjective();
  const current = missions.current();
  return {
    screen,
    wanted: police.wanted,
    money: player.money,
    health: player.health,
    ammo: player.ammo,
    driving: !player.onFoot,
    speedKmh: player.car ? Math.abs(player.car.speed) * 0.14 : 0,
    objective,
    missionTitle: current ? current.title : 'Free roam',
    clock: formatClock(clock.minutes),
    muted: audio.isMuted(),
    banner: bannerTimer > 0 ? banner : null,
    hurtFlash: player.hurtFlash,
    showHints: elapsed < 25,
    hasSave,
    missionsDone: missions.index,
  };
}

function handleActions(actions) {
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    announce(muted ? 'Muted.' : 'Sound on.');
  }
  if (screen === SCREEN_TITLE) {
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      audio.click();
      if (hasSave) continueGame();
      else startFresh();
    } else if (actions & ACTION_SHOOT) {
      audio.unlock();
      audio.click();
      clearSave();
      hasSave = false;
      startFresh();
    }
  } else if (screen === SCREEN_PLAY) {
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  } else if (screen === SCREEN_PAUSED) {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  } else if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
    if (actions & ACTION_CONFIRM) {
      audio.click();
      if (screen === SCREEN_BUSTED) respawn();
      else {
        clearSave();
        hasSave = false;
        startFresh();
      }
    }
  }
}

function stepGame(dt) {
  const actions = input.takeActions();
  handleActions(actions);
  if (screen === SCREEN_TITLE) {
    titlePan += dt;
    camera.x = 400 + Math.sin(titlePan * 0.08) * 500;
    camera.y = 900 + Math.cos(titlePan * 0.05) * 250;
    const events = [];
    entities.step(dt, { steer: { x: 0, y: 0 }, sprint: false, actions: 0, aimAngle: null }, events);
    return;
  }
  if (screen !== SCREEN_PLAY) return;

  elapsed += dt;
  const controls = {
    steer: input.steering(),
    sprint: input.sprinting(),
    actions,
    aimAngle: aimAngle(),
  };
  const events = [];
  entities.step(dt, controls, events);
  routeEvents(events);
  police.step(dt, events);
  routeEvents(events);
  missions.step(dt, events);
  routeEvents(events);

  clock.minutes = (clock.minutes + dt * CLOCK.minutesPerSecond) % (24 * 60);
  updateCamera(dt);
  audio.engine(player.car ? Math.abs(player.car.speed) / 360 : 0);
  let copNear = false;
  for (const ped of entities.state.peds) {
    if (ped.kind === 'cop') {
      const dx = ped.x - player.x;
      const dy = ped.y - player.y;
      if (dx * dx + dy * dy < 420 * 420) { copNear = true; break; }
    }
  }
  if (!copNear) {
    for (const car of entities.state.cars) {
      if (car.driver === 'police') {
        const dx = car.x - player.x;
        const dy = car.y - player.y;
        if (dx * dx + dy * dy < 420 * 420) { copNear = true; break; }
      }
    }
  }
  audio.siren(copNear, dt);

  if (bannerTimer > 0) bannerTimer -= dt;
  if (overTimer > 0) {
    overTimer -= dt;
    if (overTimer <= 0) {
      screen = SCREEN_OVER;
      if (player.money > bestMoney) bestMoney = player.money;
      announce(`Story complete. You banked $${player.money}.`);
    }
  }
  saveTimer += dt;
  if (saveTimer >= AUTOSAVE_SECONDS) {
    saveTimer = 0;
    saveGame();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  let accumulator = dt;
  while (accumulator >= STEP) {
    stepGame(STEP);
    accumulator -= STEP;
  }
  renderer.draw({
    city,
    ents: entities.state,
    hud: buildHud(),
    camera,
    minutes: clock.minutes,
  });
}

function runShot(name) {
  const game = { city, entities, police, missions, clock, camera, audio };
  stageShot(name, game);
  camera.x = player.x;
  camera.y = player.y;
  let painted = 0;
  function paint() {
    renderer.draw({
      city,
      ents: entities.state,
      hud: buildHud(),
      camera,
      minutes: clock.minutes,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

let last = performance.now();

if (shot) {
  screen = SCREEN_PLAY;
  runShot(shot);
} else {
  announce('Solara Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}
