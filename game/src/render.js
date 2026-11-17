// Drawing only: the city, everything in it, the HUD and the menu screens. The
// camera follows the player; the world is painted in world coordinates, the HUD
// in screen coordinates. Flat shapes and canvas text, no images, no network.

import { FONT, PALETTE, PLACES, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { drawMinimap } from './minimap.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const VIEW_W = 1280;
const VIEW_H = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, width: 0, height: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.width = Math.round(window.innerWidth * ratio);
    view.height = Math.round(window.innerHeight * ratio);
    canvas.width = view.width;
    canvas.height = view.height;
    view.scale = Math.min(view.width / VIEW_W, view.height / VIEW_H);
  }

  function text(value, x, y, size, color, align, baseline) {
    const key = `${size}`;
    if (!fonts.has(key)) fonts.set(key, `${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawGround(city) {
    // Grass everywhere, then the beach and the water along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, city.beachTop, WORLD.width, WORLD.height - city.beachTop);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, city.waterTop, WORLD.width, WORLD.height - city.waterTop);
    context.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < WORLD.width; x += 240) {
      context.fillRect(x + 40, city.waterTop + 24, 120, 6);
      context.fillRect(x + 140, city.waterTop + 56, 90, 5);
    }
    // Palm Park.
    context.fillStyle = PALETTE.park;
    context.fillRect(632, 832, 336, 236);
    context.fillStyle = '#3a7d5c';
    context.beginPath();
    context.arc(800, 950, 42, 0, Math.PI * 2);
    context.fill();
  }

  function drawRoads() {
    // Sidewalk blocks first (the pale gaps between road and building).
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_WIDTH / 2 - 14, 0, ROAD_WIDTH + 28, WORLD.height);
    for (const ry of ROADS_Y) context.fillRect(0, ry - ROAD_WIDTH / 2 - 14, WORLD.width, ROAD_WIDTH + 28);
    // Roads.
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD.height);
    for (const ry of ROADS_Y) context.fillRect(0, ry - ROAD_WIDTH / 2, WORLD.width, ROAD_WIDTH);
    // Lane dashes.
    context.fillStyle = PALETTE.lane;
    for (const rx of ROADS_X) {
      for (let y = 0; y < WORLD.height; y += 64) context.fillRect(rx - 2, y, 4, 32);
    }
    for (const ry of ROADS_Y) {
      for (let x = 0; x < WORLD.width; x += 64) context.fillRect(x, ry - 2, 32, 4);
    }
    // Road edge lines.
    context.strokeStyle = PALETTE.roadEdge;
    context.lineWidth = 2;
    for (const rx of ROADS_X) {
      context.beginPath();
      context.moveTo(rx - ROAD_WIDTH / 2, 0);
      context.lineTo(rx - ROAD_WIDTH / 2, WORLD.height);
      context.moveTo(rx + ROAD_WIDTH / 2, 0);
      context.lineTo(rx + ROAD_WIDTH / 2, WORLD.height);
      context.stroke();
    }
    for (const ry of ROADS_Y) {
      context.beginPath();
      context.moveTo(0, ry - ROAD_WIDTH / 2);
      context.lineTo(WORLD.width, ry - ROAD_WIDTH / 2);
      context.moveTo(0, ry + ROAD_WIDTH / 2);
      context.lineTo(WORLD.width, ry + ROAD_WIDTH / 2);
      context.stroke();
    }
  }

  function drawCity(city) {
    drawGround(city);
    drawRoads();
    // Buildings: body, darker roof inset, a row of windows, a label for landmarks.
    for (const b of city.buildings) {
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          context.fillRect(b.x + 12 + cx * 34, b.y + 12 + cy * 34, 14, 10);
        }
      }
      if (b.label) {
        text(b.label, b.x + b.w / 2, b.y + b.h / 2, 15, '#ffffff', 'center', 'middle');
      }
    }
    // Dock containers.
    for (const c of city.containers) {
      context.fillStyle = c.color;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 2;
      context.strokeRect(c.x, c.y, c.w, c.h);
    }
    // Trees.
    for (const t of city.trees) {
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3f8a3a';
      context.beginPath();
      context.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCar(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const halfL = car.length / 2;
    const halfW = car.width / 2;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(context, -halfL + 3, -halfW + 3, car.length, car.width, 8);
    context.fill();
    context.fillStyle = car.color;
    roundRect(context, -halfL, -halfW, car.length, car.width, 8);
    context.fill();
    // Roof and windshield.
    context.fillStyle = car.roof;
    roundRect(context, -halfL + 12, -halfW + 5, car.length - 26, car.width - 10, 5);
    context.fill();
    context.fillStyle = 'rgba(180,220,255,0.8)';
    context.fillRect(halfL - 14, -halfW + 4, 6, car.width - 8);
    // Headlights.
    context.fillStyle = '#ffe9a8';
    context.fillRect(halfL - 2, -halfW + 2, 3, 5);
    context.fillRect(halfL - 2, halfW - 7, 3, 5);
    // Police light bar, flashing.
    if (car.type === 'cruiser') {
      const phase = Math.floor(performance.now() / 300) % 2 === 0;
      context.fillStyle = phase ? '#ff3b30' : '#2f6fd0';
      context.fillRect(-4, -halfW + 3, 8, 6);
      context.fillStyle = phase ? '#2f6fd0' : '#ff3b30';
      context.fillRect(-4, halfW - 9, 8, 6);
      context.fillStyle = '#ffffff';
      context.fillRect(-halfL + 2, -halfW + 2, 10, 4);
    }
    if (car.type === 'taxi') {
      context.fillStyle = '#2b2b2b';
      for (let i = 0; i < 5; i += 1) context.fillRect(-halfL + 8 + i * 8, -3, 4, 6);
    }
    // Damage smoke is particles; a wrecked car sags dark.
    if (car.damage > 60) {
      context.fillStyle = 'rgba(0,0,0,0.3)';
      roundRect(context, -halfL, -halfW, car.length, car.width, 8);
      context.fill();
    }
    context.restore();
    if (isPlayer) {
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.moveTo(car.x, car.y - car.width / 2 - 16);
      context.lineTo(car.x - 7, car.y - car.width / 2 - 26);
      context.lineTo(car.x + 7, car.y - car.width / 2 - 26);
      context.closePath();
      context.fill();
    }
  }

  function drawPed(ped) {
    if (ped.state === 'fallen') {
      context.fillStyle = ped.color;
      context.beginPath();
      context.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(ped.x, ped.y + 8, 10, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
    context.fill();
    // Head and shoulders: a smaller circle offset toward the facing direction.
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
    context.fill();
    if (ped.kind === 'cop') {
      context.fillStyle = '#1c3f7d';
      context.beginPath();
      context.arc(ped.x, ped.y - 2, 6, Math.PI, 0);
      context.fill();
    }
    if (ped.kind === 'crew') {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(ped.x, ped.y - 14, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPlayer(player) {
    if (!player.onFoot) return;
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
    if (blink) return;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath();
    context.ellipse(player.x, player.y + 9, 11, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.arc(player.x + Math.cos(player.angle) * 5, player.y + Math.sin(player.angle) * 5, 5, 0, Math.PI * 2);
    context.fill();
    // Facing tick.
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(player.x + Math.cos(player.angle) * 10, player.y + Math.sin(player.angle) * 10);
    context.lineTo(player.x + Math.cos(player.angle) * 17, player.y + Math.sin(player.angle) * 17);
    context.stroke();
  }

  function drawPickups(pickups) {
    for (const p of pickups) {
      if (!p.active) continue;
      const bob = Math.sin(p.bob) * 3;
      if (p.kind === 'health') {
        context.fillStyle = '#ffffff';
        context.fillRect(p.x - 10, p.y - 10 + bob, 20, 20);
        context.fillStyle = PALETTE.red;
        context.fillRect(p.x - 3, p.y - 8 + bob, 6, 16);
        context.fillRect(p.x - 8, p.y - 3 + bob, 16, 6);
      } else if (p.kind === 'ammo') {
        context.fillStyle = '#3a3f47';
        context.fillRect(p.x - 10, p.y - 7 + bob, 20, 14);
        context.fillStyle = PALETTE.gold;
        context.fillRect(p.x - 7, p.y - 4 + bob, 4, 8);
        context.fillRect(p.x - 1, p.y - 4 + bob, 4, 8);
        context.fillRect(p.x + 5, p.y - 4 + bob, 4, 8);
      } else {
        context.fillStyle = PALETTE.green;
        context.beginPath();
        context.arc(p.x, p.y + bob, 10, 0, Math.PI * 2);
        context.fill();
        text('$', p.x, p.y + 5 + bob, 15, '#ffffff', 'center', 'middle');
      }
    }
  }

  function drawParticles(particles) {
    for (const p of particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawBullets(bullets) {
    context.fillStyle = PALETTE.bullet;
    for (const b of bullets) {
      context.fillRect(b.x - 3, b.y - 1.5, 6, 3);
    }
  }

  function drawMarker(marker, camera) {
    if (!marker) return;
    // A gold diamond in the world, plus an edge arrow when it is off screen.
    const sx = (marker.x - camera.x) * view.scale + view.width / 2;
    const sy = (marker.y - camera.y) * view.scale + view.height / 2;
    const margin = 40;
    if (sx > margin && sx < view.width - margin && sy > margin && sy < view.height - margin) {
      const pulse = 1 + Math.sin(performance.now() / 300) * 0.15;
      context.save();
      context.translate(sx, sy);
      context.scale(pulse, pulse);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(0, -14);
      context.lineTo(10, 0);
      context.lineTo(0, 14);
      context.lineTo(-10, 0);
      context.closePath();
      context.fill();
      context.restore();
    } else {
      const cx = Math.max(margin, Math.min(view.width - margin, sx));
      const cy = Math.max(margin, Math.min(view.height - margin, sy));
      const angle = Math.atan2(sy - view.height / 2, sx - view.width / 2);
      context.save();
      context.translate(cx, cy);
      context.rotate(angle);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(14, 0);
      context.lineTo(-8, -9);
      context.lineTo(-8, 9);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawStars(wanted, x, y) {
    for (let i = 0; i < 5; i += 1) {
      text('★', x + i * 26, y, 26, i < wanted ? PALETTE.gold : 'rgba(255,255,255,0.25)', 'left', 'top');
    }
  }

  function drawHud(hud) {
    const pad = 18;
    // Top-left: wanted stars, money, health.
    drawStars(hud.wanted, pad, pad);
    text(`$${hud.money}`, pad, pad + 34, 24, PALETTE.text, 'left', 'top');
    context.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(context, pad, pad + 66, 180, 16, 8);
    context.fill();
    context.fillStyle = hud.health > 30 ? PALETTE.green : PALETTE.red;
    roundRect(context, pad, pad + 66, Math.max(0, 180 * (hud.health / 100)), 16, 8);
    context.fill();
    text(`HP ${Math.ceil(hud.health)}`, pad + 190, pad + 66, 16, PALETTE.text, 'left', 'top');
    text(`Ammo ${hud.ammo}`, pad, pad + 90, 16, PALETTE.muted, 'left', 'top');
    // Top-centre: mission objective.
    if (hud.objective) {
      const lines = hud.objective.text.split('\n');
      const width = 560;
      const x = (view.width - width) / 2;
      context.fillStyle = PALETTE.panel;
      roundRect(context, x, pad, width, 30 + lines.length * 22, 10);
      context.fill();
      text(`★ ${hud.missionTitle}`, x + 16, pad + 22, 15, PALETTE.gold, 'left', 'top');
      for (let i = 0; i < lines.length; i += 1) {
        text(lines[i], x + 16, pad + 44 + i * 22, 17, PALETTE.text, 'left', 'top');
      }
      if (hud.objective.progress !== null && hud.objective.progress !== undefined) {
        context.fillStyle = 'rgba(255,255,255,0.2)';
        roundRect(context, x + 16, pad + 44 + lines.length * 22, width - 32, 8, 4);
        context.fill();
        context.fillStyle = PALETTE.gold;
        roundRect(context, x + 16, pad + 44 + lines.length * 22, (width - 32) * hud.objective.progress, 8, 4);
        context.fill();
      }
    }
    // Bottom-right: speed and the clock.
    if (hud.driving) {
      text(`${Math.round(hud.speedKmh)} mph`, view.width - pad, view.height - pad - 24, 26, PALETTE.text, 'right', 'top');
    }
    text(hud.clock, view.width - pad, view.height - pad, 16, PALETTE.muted, 'right', 'top');
    if (hud.muted) text('Muted (M)', view.width - pad, view.height - pad - 44, 14, PALETTE.muted, 'right', 'top');
    // Bottom-left: controls hint.
    if (hud.showHints) {
      text('WASD move · Shift sprint · E enter car · F punch · Space / click shoot · P pause · M mute', pad, view.height - pad, 14, PALETTE.muted, 'left', 'top');
    }
    // Banner (mission start / complete).
    if (hud.banner) {
      const width = 620;
      const x = (view.width - width) / 2;
      const y = view.height * 0.3;
      context.fillStyle = PALETTE.panel;
      roundRect(context, x, y, width, 84, 12);
      context.fill();
      text(hud.banner.title, view.width / 2, y + 36, 26, PALETTE.gold, 'center', 'top');
      text(hud.banner.sub, view.width / 2, y + 64, 16, PALETTE.text, 'center', 'top');
    }
    // Hurt flash.
    if (hud.hurtFlash > 0) {
      context.fillStyle = `rgba(229, 83, 75, ${Math.min(0.35, hud.hurtFlash)})`;
      context.fillRect(0, 0, view.width, view.height);
    }
  }

  function drawDayTint(minutes) {
    // 06:00-18:00 day, 18:00-20:00 dusk, 20:00-06:00 night.
    const hour = minutes / 60;
    if (hour >= 18 && hour < 20) {
      context.fillStyle = PALETTE.skyDusk;
      context.fillRect(0, 0, view.width, view.height);
    } else if (hour >= 20 || hour < 6) {
      context.fillStyle = PALETTE.skyNight;
      context.fillRect(0, 0, view.width, view.height);
    } else if (hour >= 6 && hour < 8) {
      context.fillStyle = PALETTE.skyDay;
      context.fillRect(0, 0, view.width, view.height);
    }
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (view.width - width) / 2;
    const y = (view.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    roundRect(context, x, y, width, height, 14);
    context.stroke();
    text(title, view.width / 2, y + 62, 44, PALETTE.text, 'center', 'top');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], view.width / 2, y + 118 + i * 30, 19, PALETTE.muted, 'center', 'top');
    }
    text(prompt, view.width / 2, y + height - 44, 20, PALETTE.gold, 'center', 'top');
  }

  /** Paint one frame: the world through the camera, then the HUD or a menu screen. */
  function draw(frame) {
    const { city, ents, hud, camera, minutes } = frame;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#10141c';
    context.fillRect(0, 0, view.width, view.height);
    const scale = view.scale;
    const camX = camera.x - view.width / 2 / scale;
    const camY = camera.y - view.height / 2 / scale;
    context.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    drawCity(city);
    drawPickups(ents.pickups);
    for (const car of ents.cars) drawCar(car, !ents.player.onFoot && ents.player.car === car);
    for (const ped of ents.peds) drawPed(ped);
    drawPlayer(ents.player);
    drawParticles(ents.particles);
    drawBullets(ents.bullets);
    context.setTransform(1, 0, 0, 1, 0, 0);
    drawDayTint(minutes);
    if (hud.screen === SCREEN_PLAY || hud.screen === SCREEN_PAUSED) {
      drawMarker(hud.objective ? hud.objective.marker : null, camera);
      drawMinimap(context, view, city, ents, hud);
      drawHud(hud);
      if (hud.screen === SCREEN_PAUSED) {
        drawPanel('Paused', ['The city waits for you.'], 'Press P or Esc to keep playing');
      }
    } else if (hud.screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(10, 14, 20, 0.55)';
      context.fillRect(0, 0, view.width, view.height);
      text('SOLARA BAY', view.width / 2, view.height * 0.13, 72, PALETTE.text, 'center', 'top');
      text('An open-world crime story in the sun', view.width / 2, view.height * 0.13 + 84, 22, PALETTE.gold, 'center', 'top');
      const lines = [
        'WASD drive and walk · Shift sprint · E steal a car · F punch',
        'Space or click to shoot · P pause · M mute · Your progress saves itself',
        hud.hasSave ? `Continue: $${hud.money} · ${hud.missionsDone} of 4 jobs done` : 'New story: 4 jobs for Vic, starting with a taxi',
      ];
      drawPanel(' ', lines, hud.hasSave ? 'Press Enter to continue — or Space to start fresh' : 'Press Enter or click to start');
    } else if (hud.screen === SCREEN_OVER) {
      drawPanel('Story complete', [`You finished all four jobs and banked $${hud.money}.`, 'Solara Bay is yours — keep roaming, or play it again.'], 'Press Enter to play again');
    } else if (hud.screen === SCREEN_BUSTED) {
      drawPanel('Busted', ['The Solara Bay police caught up with you.', `You kept $${hud.money} — the hospital patched you up.`], 'Press Enter to get back out there');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
