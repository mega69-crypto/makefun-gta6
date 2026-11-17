// Punching and the damage it does. A punch is a short arc in the direction the
// player faces: it drops pedestrians and dents police cars (which the law
// notices). Shooting lives in entities, where the bullets are.

import { PLAYER } from './config.js';

export function createCombat(deps) {
  const { state, hurtPed, addParticles } = deps;

  function punch(player, aimAngle, events) {
    const hx = player.x + Math.cos(aimAngle) * 22;
    const hy = player.y + Math.sin(aimAngle) * 22;
    let hit = false;
    for (const ped of state.peds) {
      if (ped.state === 'fallen') continue;
      const dx = ped.x - hx;
      const dy = ped.y - hy;
      if (dx * dx + dy * dy < PLAYER.punchRange * PLAYER.punchRange) {
        hurtPed(ped, PLAYER.punchDamage, 'player', events);
        hit = true;
      }
    }
    for (const car of state.cars) {
      if (car.driver === 'police') {
        const dx = car.x - hx;
        const dy = car.y - hy;
        if (dx * dx + dy * dy < (PLAYER.punchRange + 20) * (PLAYER.punchRange + 20)) {
          events.push({ kind: 'crime', stars: 1, reason: 'hit a police car' });
          hit = true;
        }
      }
    }
    if (hit) addParticles(hx, hy, 4, '#ffffff', 120, 0.25, 3);
    return hit;
  }

  return { punch };
}
